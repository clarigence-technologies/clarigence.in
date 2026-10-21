package in.clarigence.contactapi;

import in.clarigence.contactapi.repository.ContactRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EnquiryDowntimeIntegrationTest {
    @Autowired MockMvc mvc;
    @MockitoBean ContactRepository contacts;
    @Test void databaseFailureReturnsRealServiceUnavailable() throws Exception {
        when(contacts.saveAndFlush(any())).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("offline"));
        mvc.perform(post("/api/contact").contentType("application/json").content("""
                {"name":"Downtime Test","email":"test@example.com","service":"Website Development",
                 "message":"This enquiry must not report success."}
                """))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.id").doesNotExist());
    }
}
