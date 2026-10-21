package in.clarigence.contactapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import in.clarigence.contactapi.repository.ContactRepository;
import in.clarigence.contactapi.dto.ContactRequest;
import in.clarigence.contactapi.service.ContactService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(properties = {
        "clarigence.enquiry-email.enabled=true",
        "clarigence.enquiry-email.to=hello@clarigence.in",
        "clarigence.enquiry-email.from=notifications@example.com"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class EnquiryEmailIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ContactRepository contacts;
    @Autowired private ContactService service;
    @Autowired private PlatformTransactionManager transactions;
    @MockitoBean private JavaMailSender sender;

    private static final String REQUEST = """
            {"name":"Taylor Example", "email":"taylor@example.com", "phone":"",
             "company":"Example Studio", "service":"Web development",
             "message":"We need a new company website."}
            """;

    @Test
    void sendsEnquiryDetailsOnlyAfterSaving() throws Exception {
        long before = contacts.count();
        org.mockito.Mockito.doAnswer(invocation -> {
            assertThat(contacts.count()).isEqualTo(before + 1);
            return null;
        }).when(sender).send(any(SimpleMailMessage.class));

        mvc.perform(post("/api/contact").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isCreated());

        ArgumentCaptor<SimpleMailMessage> mail = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(mail.capture());
        assertThat(mail.getValue().getTo()).containsExactly("hello@clarigence.in");
        assertThat(mail.getValue().getFrom()).isEqualTo("notifications@example.com");
        assertThat(mail.getValue().getReplyTo()).isEqualTo("taylor@example.com");
        assertThat(mail.getValue().getSubject()).startsWith("New Clarigence enquiry #");
        assertThat(mail.getValue().getText()).contains("Name: Taylor Example", "Email: taylor@example.com",
                "Phone: Not provided", "Company: Example Studio", "Service: Web development",
                "Message:\nWe need a new company website.");
    }

    @Test
    void mailFailureStillReturnsSuccessAndKeepsEnquiry(CapturedOutput output) throws Exception {
        long before = contacts.count();
        doThrow(new MailSendException("private-provider-error-secret", new java.net.SocketTimeoutException("private-provider-error-secret")))
                .when(sender).send(any(SimpleMailMessage.class));
        mvc.perform(post("/api/contact").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isCreated());
        assertThat(contacts.count()).isEqualTo(before + 1);
        assertThat(output.getAll()).contains("saved successfully", "Email sending started", "Email sending failed",
                "MailSendException", "timed out", "Enquiry remains saved").doesNotContain("private-provider-error-secret");
    }

    @Test
    void failedNotificationCanBeRetriedByAdminOnly() throws Exception {
        doThrow(new MailSendException("private-secret")).when(sender).send(any(SimpleMailMessage.class));
        var result = mvc.perform(post("/api/contact").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isCreated()).andReturn();
        long id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(result.getResponse().getContentAsString()).get("id").asLong();
        assertThat(contacts.findById(id).orElseThrow().getNotificationStatus()).isEqualTo("FAILED");
        mvc.perform(post("/api/admin/enquiries/{id}/notification/retry", id).with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/enquiries/{id}/notification/retry", id).with(user("admin").roles("ADMIN")))
                .andExpect(status().isForbidden());
        reset(sender);
        mvc.perform(post("/api/admin/enquiries/{id}/notification/retry", id).with(user("admin").roles("ADMIN")).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.notificationStatus").value("SENT"));
        verify(sender).send(any(SimpleMailMessage.class));
        reset(sender);
        mvc.perform(post("/api/admin/enquiries/{id}/notification/retry", id).with(user("admin").roles("ADMIN")).with(csrf()))
                .andExpect(status().isOk());
        verifyNoInteractions(sender);
        mvc.perform(get("/api/admin/enquiries/{id}", id).with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.notificationAttemptedAt").exists());
    }

    @Test
    void retryingSameSubmissionDoesNotSendTwice() throws Exception {
        String key = java.util.UUID.randomUUID().toString();
        long before = contacts.count();
        for (int i = 0; i < 2; i++) mvc.perform(post("/api/contact").header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON).content(REQUEST)).andExpect(status().isCreated());
        assertThat(contacts.count()).isEqualTo(before + 1);
        verify(sender).send(any(SimpleMailMessage.class));
        mvc.perform(post("/api/contact").header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                .content(REQUEST.replace("Taylor Example", "Changed Name"))).andExpect(status().isConflict());
    }

    @Test
    void concurrentDuplicateRequestsSaveAndNotifyOnce() throws Exception {
        String key = java.util.UUID.randomUUID().toString();
        long before = contacts.count();
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var start = new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.Callable<Integer> submit = () -> {
                start.await();
                return mvc.perform(post("/api/contact").header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                        .andReturn().getResponse().getStatus();
            };
            var first = executor.submit(submit);
            var second = executor.submit(submit);
            start.countDown();
            assertThat(first.get()).isEqualTo(201);
            assertThat(second.get()).isEqualTo(201);
        }
        assertThat(contacts.count()).isEqualTo(before + 1);
        verify(sender).send(any(SimpleMailMessage.class));
    }

    @Test
    void rolledBackEnquiryDoesNotSendEmail() {
        long before = contacts.count();
        new TransactionTemplate(transactions).executeWithoutResult(transaction -> {
            service.create(new ContactRequest("Taylor Example", "taylor@example.com", "", "",
                    "Web development", "We need a new company website."));
            verifyNoInteractions(sender);
            transaction.setRollbackOnly();
        });
        assertThat(contacts.count()).isEqualTo(before);
        verifyNoInteractions(sender);
    }

    @Test
    void invalidEnquiryDoesNotSendEmail() throws Exception {
        mvc.perform(post("/api/contact").contentType(MediaType.APPLICATION_JSON)
                        .content(REQUEST.replace("taylor@example.com", "invalid")))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(sender);
    }
}
