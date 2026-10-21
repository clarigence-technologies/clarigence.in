package in.clarigence.contactapi;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ContactControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createsContactAndReturnsCreatedTimestamp() throws Exception {
        mockMvc.perform(post("/api/contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Taylor Example",
                                  "email": "taylor@example.com",
                                  "phone": "+1 555 0100",
                                  "company": "Example Studio",
                                  "service": "Web development",
                                  "message": "We need a new company website."
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.message").value("Your enquiry has been received."))
                .andExpect(jsonPath("$.createdAt", matchesPattern(".+Z$")));
    }

    @Test
    void rejectsInvalidFieldsWithJsonErrors() throws Exception {
        mockMvc.perform(post("/api/contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": " ",
                                  "email": "not-an-email",
                                  "phone": "",
                                  "company": "",
                                  "service": "Web development",
                                  "message": "Short"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.fieldErrors.message").exists());
    }

    @Test
    void validatesTrimmedMessageAndAllowsIdempotencyCorsHeader() throws Exception {
        mockMvc.perform(post("/api/contact").contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"Taylor", "email":"taylor@example.com", "service":"Website Development",
                 "message":"x          "}
                """))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.message").exists());
        mockMvc.perform(options("/api/contact").header("Origin", "http://localhost:8000")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type,idempotency-key"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Headers", org.hamcrest.Matchers.containsString("idempotency-key")));
    }

    @Test
    void allowsFrontendCorsOrigin() throws Exception {
        mockMvc.perform(options("/api/contact")
                        .header("Origin", "http://localhost:8000")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:8000"));
    }
}
