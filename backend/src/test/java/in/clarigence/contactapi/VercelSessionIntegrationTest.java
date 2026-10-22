package in.clarigence.contactapi;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import in.clarigence.contactapi.entity.AdminUser;
import in.clarigence.contactapi.repository.AdminUserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {
        "ENQUIRY_EMAIL_ENABLED=true",
        "spring.session.jdbc.initialize-schema=always",
        "spring.datasource.url=jdbc:h2:mem:vercel_session_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
})
@AutoConfigureMockMvc
@ActiveProfiles({"production", "vercel", "test"})
class VercelSessionIntegrationTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private AdminUserRepository adminUserRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private org.springframework.core.env.Environment environment;
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private org.springframework.mail.javamail.JavaMailSender mailSender;

    @Test
    void storesEnquiriesWithoutEmailAndRestrictsDetailsToAdmin() throws Exception {
        assertEquals(false, environment.getProperty("clarigence.enquiry-email.enabled", Boolean.class));
        MvcResult result = mockMvc.perform(post("/api/contact").secure(true)
                        .contentType("application/json")
                        .content("""
                                {"name":"Vercel Test", "email":"visitor@example.com", "phone":"",
                                 "company":"", "service":"Web development",
                                 "message":"Please discuss a company website with us."}
                                """))
                .andExpect(status().isCreated()).andReturn();
        long id = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(result.getResponse().getContentAsString()).get("id").asLong();
        mockMvc.perform(get("/api/admin/enquiries/" + id).secure(true))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/enquiries/" + id).secure(true)
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.email").value("visitor@example.com"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.notificationStatus").value("DISABLED"));
        org.mockito.Mockito.verifyNoInteractions(mailSender);
    }

    @Test
    void restoresLoginFromDatabaseAndProtectsLogoutWithCsrf() throws Exception {
        adminUserRepository.saveAndFlush(new AdminUser(
                "session-admin@example.com", passwordEncoder.encode("isolated-test-password-123")));
        Cookie csrf = mockMvc.perform(get("/api/admin/auth/csrf").secure(true))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(csrf);

        MvcResult login = mockMvc.perform(post("/api/admin/auth/login").secure(true)
                        .cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType("application/json")
                        .content("{\"email\":\"session-admin@example.com\",\"password\":\"isolated-test-password-123\"}"))
                .andExpect(status().isOk()).andReturn();
        Cookie session = login.getResponse().getCookie("JSESSIONID");
        assertNotNull(session);
        assertTrue(login.getResponse().getHeaders("Set-Cookie").stream().anyMatch(value ->
                value.startsWith("JSESSIONID=") && value.contains("Secure")
                        && value.contains("HttpOnly") && value.contains("SameSite=Strict")));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM SPRING_SESSION", Integer.class));
        assertTrue(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SPRING_SESSION_ATTRIBUTES", Integer.class) > 0);

        // A fresh request has only the cookie: no in-memory MockHttpSession is reused.
        mockMvc.perform(get("/api/admin/dashboard").secure(true).cookie(session))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/admin/auth/logout").secure(true).cookie(session))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/auth/logout").secure(true)
                        .cookie(session, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        assertEquals(0, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM SPRING_SESSION", Integer.class));
        mockMvc.perform(get("/api/admin/dashboard").secure(true).cookie(session))
                .andExpect(status().isUnauthorized());
    }
}
