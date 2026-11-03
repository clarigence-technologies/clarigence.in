package in.clarigence.contactapi;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.clarigence.contactapi.repository.*;
import in.clarigence.contactapi.service.CmsInitializationService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class ClientIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired WebsiteServiceRepository services;
    @Autowired PortfolioProjectRepository projects;
    @Autowired ClientLogoRepository clients;
    @Autowired SiteDocumentRepository documents;
    @Autowired CmsInitializationService initialization;

    @BeforeEach void resetCms() throws Exception {services.deleteAll();projects.deleteAll();clients.deleteAll();documents.deleteAll();initialization.initialize();}

    private Map<String,Object> client(String name,boolean active){
        Map<String,Object> r=new LinkedHashMap<>();r.put("name",name);r.put("logoUrl","assets/clients/test-logo.png");r.put("websiteUrl","www.example.com");r.put("displayOrder",5);r.put("active",active);return r;
    }

    @Test void newDatabaseImportsLiveContent() throws Exception {
        assertEquals(8,projects.count());assertEquals(4,clients.count());
        mvc.perform(get("/api/portfolio")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(8)).andExpect(jsonPath("$[0].title").value("Sinnar Mobile")).andExpect(jsonPath("$[0].featured").value(true));
        mvc.perform(get("/api/clients")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(4)).andExpect(jsonPath("$[0].name").value("Sinnar Mobile")).andExpect(jsonPath("$[0].id").doesNotExist());
        mvc.perform(get("/api/content/business")).andExpect(jsonPath("$.address").value("Nashik, India"));
        initialization.initialize();assertEquals(8,projects.count());assertEquals(4,clients.count());
    }

    @Test void existingDatabaseReceivesPortfolioAndClientsOnce() throws Exception {
        // Simulates the earlier VPS database: initialized, services only, no import marker.
        projects.deleteAll();clients.deleteAll();documents.deleteById("content-import-v1");
        assertTrue(documents.existsById("cms-initialized"));
        initialization.initialize();
        assertEquals(8,projects.count());assertEquals(4,clients.count());assertEquals(10,services.count());
        // Deliberate deletions afterwards are not undone by later restarts.
        projects.deleteAll();clients.deleteAll();initialization.initialize();
        assertEquals(0,projects.count());assertEquals(0,clients.count());
    }

    @Test @WithMockUser(roles="ADMIN") void projectSwitchControlsHappyClients() throws Exception {
        // Seeded logos are linked to the portfolio project with the same name.
        assertEquals("sinnar-mobile",clients.findByProjectSlug("sinnar-mobile").orElseThrow().getProjectSlug());
        assertEquals(4,clients.findAll().stream().filter(c->c.getProjectSlug()!=null).count());
        String slug="digital-presence-reimagined",path="/api/admin/clients/project/"+slug;
        // A logo is required the first time.
        mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"show\":true}")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.clientLogoUrl").exists());
        mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"show\":true,\"logoUrl\":\"/api/portfolio/images/logo.png\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Digital presence, reimagined.")).andExpect(jsonPath("$.projectSlug").value(slug));
        mvc.perform(get("/api/clients")).andExpect(jsonPath("$.length()").value(5));
        // Switching off hides the logo but keeps it; switching on again needs no new upload.
        mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"show\":false}")).andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        mvc.perform(get("/api/clients")).andExpect(jsonPath("$.length()").value(4));
        mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"show\":true}")).andExpect(status().isOk()).andExpect(jsonPath("$.logoUrl").value("/api/portfolio/images/logo.png"));
        // A draft (unpublished) project keeps its logo hidden.
        var project=projects.findBySlug(slug).orElseThrow();project.setActive(false);projects.saveAndFlush(project);
        mvc.perform(get("/api/clients")).andExpect(jsonPath("$.length()").value(4));
        // Deleting the project removes its logo.
        mvc.perform(delete("/api/admin/cms/portfolio/"+project.getId()).with(csrf())).andExpect(status().isNoContent());
        assertTrue(clients.findByProjectSlug(slug).isEmpty());
        // Switching off a project without a logo does nothing; unknown projects are rejected.
        mvc.perform(put("/api/admin/clients/project/shopping-made-simpler").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"show\":false}")).andExpect(status().isNoContent());
        mvc.perform(put("/api/admin/clients/project/no-such-project").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"show\":true}")).andExpect(status().isNotFound());
    }

    @Test void adminRoutesRequireLogin() throws Exception {
        mvc.perform(get("/api/admin/clients")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/clients").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(client("Anonymous",true)))).andExpect(status().isUnauthorized());
    }

    @Test @WithMockUser(roles="ADMIN") void adminManagesClients() throws Exception {
        String created=mvc.perform(post("/api/admin/clients").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(client("New Client",false))))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.websiteUrl").value("https://www.example.com")).andReturn().getResponse().getContentAsString();
        var saved=json.readValue(created,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
        mvc.perform(get("/api/clients")).andExpect(jsonPath("$.length()").value(4));
        saved.put("active",true);
        mvc.perform(put("/api/admin/clients/"+saved.get("id")).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(saved))).andExpect(status().isOk());
        mvc.perform(get("/api/clients")).andExpect(jsonPath("$.length()").value(5)).andExpect(jsonPath("$[0].name").value("New Client"));
        mvc.perform(put("/api/admin/clients/"+saved.get("id")).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(saved))).andExpect(status().isConflict());
        mvc.perform(delete("/api/admin/clients/"+saved.get("id")).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/clients")).andExpect(jsonPath("$.length()").value(4));
    }

    @Test @WithMockUser(roles="ADMIN") void rejectsUnsafeLogoAndWebsite() throws Exception {
        var badLogo=client("Bad logo",true);badLogo.put("logoUrl","javascript:alert(1)");
        mvc.perform(post("/api/admin/clients").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(badLogo))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.logoUrl").exists());
        var badSite=client("Bad site",true);badSite.put("websiteUrl","javascript:alert(1)");
        mvc.perform(post("/api/admin/clients").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(badSite))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.websiteUrl").exists());
    }
}
