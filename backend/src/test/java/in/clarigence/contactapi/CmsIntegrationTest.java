package in.clarigence.contactapi;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.clarigence.contactapi.repository.*;
import in.clarigence.contactapi.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class CmsIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired WebsiteServiceRepository services;
    @Autowired PortfolioProjectRepository projects;
    @Autowired SiteDocumentRepository documents;
    @Autowired CmsInitializationService initialization;
    @Autowired SiteContentService content;

    @BeforeEach void resetCms() throws Exception {services.deleteAll();projects.deleteAll();documents.deleteAll();initialization.initialize();}
    private Map<String,Object> item(String slug,boolean active){
        Map<String,Object> r=new LinkedHashMap<>();r.put("name","Verification content");r.put("slug",slug);r.put("shortDescription","A test record in the isolated database.");r.put("description","Useful content for testing the CMS without touching MySQL.");r.put("icon","window");r.put("imageUrl","");r.put("displayOrder",1);r.put("active",active);r.put("capabilities",List.of("Planning","Development"));r.put("benefits",List.of("Clear processes"));r.put("technologies",List.of("Java"));r.put("featured",true);r.put("concept",true);return r;
    }
    @Test @WithMockUser(roles="ADMIN") void optionalPortfolioPhotoUpload() throws Exception {
        var output=new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",output);
        byte[] bytes=output.toByteArray();
        var file=new org.springframework.mock.web.MockMultipartFile("file","photo.png","image/png",bytes);
        mvc.perform(multipart("/api/admin/cms/portfolio/images").file(file)).andExpect(status().isForbidden());
        var result=mvc.perform(multipart("/api/admin/cms/portfolio/images").file(file).with(csrf()))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String path=json.readTree(result).get("imageUrl").asText();
        mvc.perform(get(path)).andExpect(status().isOk()).andExpect(content().contentType("image/png")).andExpect(content().bytes(bytes));
        var request=item("uploaded-photo",true);request.put("imageUrl",path);create("portfolio",request);
        mvc.perform(get("/api/portfolio/uploaded-photo")).andExpect(jsonPath("$.imageUrl").value(path));
        create("portfolio",item("no-photo",true));
        mvc.perform(multipart("/api/admin/cms/portfolio/images").file(new org.springframework.mock.web.MockMultipartFile("file","fake.png","image/png","invalid".getBytes())).with(csrf()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.photo").exists());
        mvc.perform(multipart("/api/admin/cms/portfolio/images").file(new org.springframework.mock.web.MockMultipartFile("file","big.png","image/png",new byte[5*1024*1024+1])).with(csrf()))
            .andExpect(status().isBadRequest());
    }
    @Test void photoUploadRequiresLogin() throws Exception {
        mvc.perform(multipart("/api/admin/cms/portfolio/images").file(new org.springframework.mock.web.MockMultipartFile("file","photo.png","image/png",new byte[]{1})).with(csrf()))
            .andExpect(status().isUnauthorized());
    }
    private Map<String,Object> create(String kind,Map<String,Object> request) throws Exception {
        String result=mvc.perform(post("/api/admin/cms/"+kind).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readValue(result,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
    }
    @Test void publicApiSeedAndPrivateFields() throws Exception {
        mvc.perform(get("/api/services")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(10)).andExpect(jsonPath("$[0].slug").value("website-development")).andExpect(jsonPath("$[0].id").doesNotExist()).andExpect(jsonPath("$[0].version").doesNotExist());
        mvc.perform(get("/api/services/website-development")).andExpect(status().isOk()).andExpect(jsonPath("$.capabilities[0]").isNotEmpty());
        mvc.perform(get("/api/portfolio")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/content/business")).andExpect(status().isOk()).andExpect(jsonPath("$.email").value("hello@clarigence.in")).andExpect(jsonPath("$.phone").doesNotExist()).andExpect(jsonPath("$.version").doesNotExist());
        assertTrue(documents.existsById("business-email-corrected-v2"));
        mvc.perform(get("/api/content/cms-initialized")).andExpect(status().isNotFound());
    }
    @Test void seedIsIdempotentAndDoesNotResurrectDeletedServices() throws Exception {
        initialization.initialize();assertEquals(10,services.count());services.deleteAll();initialization.initialize();assertEquals(0,services.count());
    }
    @Test void migratesOnlyLegacyBusinessEmailAndRunsOnce() throws Exception {
        documents.deleteById("business-email-corrected-v2");
        var business=documents.findById("business").orElseThrow();
        ObjectNode before=(ObjectNode)json.readTree(business.getContentJson());
        before.put("email","clarigence@gmail.com");
        before.put("tagline","A custom business tagline");
        before.put("customSetting","Retain this setting");
        business.setContentJson(json.writeValueAsString(before));
        business=documents.saveAndFlush(business);
        long versionBefore=business.getVersion();

        initialization.initialize();

        var migrated=documents.findById("business").orElseThrow();
        ObjectNode expected=before.deepCopy();
        expected.put("email","hello@clarigence.in");
        assertEquals(expected,json.readTree(migrated.getContentJson()));
        assertEquals(versionBefore+1,migrated.getVersion());
        assertTrue(documents.existsById("business-email-corrected-v2"));

        initialization.initialize();
        assertEquals(expected,json.readTree(documents.findById("business").orElseThrow().getContentJson()));
        assertEquals(versionBefore+1,documents.findById("business").orElseThrow().getVersion());
    }
    @Test void correctsMisspelledEmailAfterPreviousMigration() throws Exception {
        documents.deleteById("business-email-corrected-v2");
        documents.saveAndFlush(new in.clarigence.contactapi.entity.SiteDocument("business-email-migrated","{}"));
        var business=documents.findById("business").orElseThrow();
        ObjectNode values=(ObjectNode)json.readTree(business.getContentJson());
        values.put("email","hello@clargience.in");
        business.setContentJson(json.writeValueAsString(values));
        documents.saveAndFlush(business);
        initialization.initialize();
        assertEquals("hello@clarigence.in",json.readTree(documents.findById("business").orElseThrow().getContentJson()).get("email").textValue());
        assertTrue(documents.existsById("business-email-corrected-v2"));
    }
    @Test void preservesCustomBusinessEmailOnStartup() throws Exception {
        documents.deleteById("business-email-corrected-v2");
        var business=documents.findById("business").orElseThrow();
        ObjectNode custom=(ObjectNode)json.readTree(business.getContentJson());
        custom.put("email","team@example.org");
        business.setContentJson(json.writeValueAsString(custom));
        business=documents.saveAndFlush(business);
        long versionBefore=business.getVersion();

        initialization.initialize();

        var unchanged=documents.findById("business").orElseThrow();
        assertEquals(custom,json.readTree(unchanged.getContentJson()));
        assertEquals(versionBefore,unchanged.getVersion());
        assertTrue(documents.existsById("business-email-corrected-v2"));

        custom.put("email","clarigence@gmail.com");
        unchanged.setContentJson(json.writeValueAsString(custom));
        unchanged=documents.saveAndFlush(unchanged);
        long manuallyEditedVersion=unchanged.getVersion();
        initialization.initialize();
        assertEquals(custom,json.readTree(documents.findById("business").orElseThrow().getContentJson()));
        assertEquals(manuallyEditedVersion,documents.findById("business").orElseThrow().getVersion());
    }
    @Test void authenticationAndCsrfRequired() throws Exception {
        for(String kind:List.of("services","portfolio")){
            mvc.perform(get("/api/admin/cms/"+kind)).andExpect(status().isUnauthorized());
            mvc.perform(post("/api/admin/cms/"+kind).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item("private-test",true)))).andExpect(status().isUnauthorized());
            mvc.perform(put("/api/admin/cms/"+kind+"/1").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item("private-test",true)))).andExpect(status().isUnauthorized());
            mvc.perform(delete("/api/admin/cms/"+kind+"/1").with(csrf())).andExpect(status().isUnauthorized());
        }
        mvc.perform(put("/api/admin/content/home").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
    }
    @Test @WithMockUser(roles="USER") void nonAdminCannotWrite() throws Exception {
        mvc.perform(post("/api/admin/cms/services").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item("restricted",true)))).andExpect(status().isForbidden());
    }
    @Test @WithMockUser(roles="ADMIN") void missingCsrfDenied() throws Exception {
        mvc.perform(post("/api/admin/cms/services").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(item("no-csrf",true)))).andExpect(status().isForbidden());
        mvc.perform(put("/api/admin/content/home").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
    }
    @Test @WithMockUser(roles="ADMIN") void serviceCrudPublicationOrderAndConflict() throws Exception {
        Map<String,Object> saved=create("services",item("verification-service",true));Long id=((Number)saved.get("id")).longValue();
        mvc.perform(get("/api/services")).andExpect(jsonPath("$[0].slug").value("verification-service"));
        saved.put("name","Edited service");saved.put("active",false);
        mvc.perform(put("/api/admin/cms/services/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(saved))).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        mvc.perform(get("/api/services/verification-service")).andExpect(status().isNotFound());
        mvc.perform(put("/api/admin/cms/services/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(saved))).andExpect(status().isConflict());
        mvc.perform(delete("/api/admin/cms/services/"+id).with(csrf())).andExpect(status().isNoContent());assertFalse(services.existsById(id));
    }
    @Test @WithMockUser(roles="ADMIN") void serviceValidationAndStableSlugs() throws Exception {
        Map<String,Object> r=item("website-development",true);
        mvc.perform(post("/api/admin/cms/services").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(r))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.slug").exists());
        r.put("slug","INVALID SLUG");r.put("name"," ");r.put("displayOrder",-1);
        mvc.perform(post("/api/admin/cms/services").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(r))).andExpect(status().isBadRequest());
        for(String unsafe:List.of("javascript:alert(1)","assets/../private.png","//evil.example/file.png","https://example.com/payload.svg","assets/test.php","assets/%2e%2e/private.png")){
            r=item("safe-test",true);r.put("imageUrl",unsafe);
            mvc.perform(post("/api/admin/cms/services").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(r))).andExpect(status().isBadRequest());
        }
        Map<String,Object> saved=create("services",item("stable-service",true));saved.put("slug","changed-service");
        mvc.perform(put("/api/admin/cms/services/"+saved.get("id")).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(saved))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.slug").exists());
    }
    @Test @WithMockUser(roles="ADMIN") void portfolioCrudAndPublication() throws Exception {
        Map<String,Object> saved=create("portfolio",item("internal-verification-concept",false));String path="/api/admin/cms/portfolio/"+saved.get("id");
        mvc.perform(get("/api/portfolio")).andExpect(jsonPath("$.length()").value(0));saved.put("active",true);
        String updated=mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(saved))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/portfolio/internal-verification-concept")).andExpect(status().isOk()).andExpect(jsonPath("$.concept").value(true)).andExpect(jsonPath("$.featured").value(true));
        saved=json.readValue(updated,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});saved.put("active",false);
        mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(saved))).andExpect(status().isOk());
        mvc.perform(get("/api/portfolio/internal-verification-concept")).andExpect(status().isNotFound());
        mvc.perform(delete(path).with(csrf())).andExpect(status().isNoContent());assertEquals(0,projects.count());
    }
    @Test @WithMockUser(roles="ADMIN") void portfolioFieldsRoundTripAndPersistAcrossRequests() throws Exception {
        Map<String,Object> request=item("portfolio-round-trip",true);
        request.put("category","Business websites");request.put("projectUrl","www.abc.com/work?view=1#demo");
        request.put("imageUrl","/images/project.PNG?v=1");request.put("concept",false);
        Map<String,Object> saved=create("portfolio",request);String path="/api/admin/cms/portfolio/"+saved.get("id");
        request.put("projectUrl","https://www.abc.com/work?view=1#demo");
        assertPortfolioFields(request,saved);
        mvc.perform(get("/api/portfolio/portfolio-round-trip")).andExpect(jsonPath("$.projectUrl").value(request.get("projectUrl"))).andExpect(jsonPath("$.imageUrl").value(request.get("imageUrl")));
        saved.put("name","Updated project");saved.put("shortDescription","Updated summary");saved.put("description","Updated full description\nWith a second line.");
        saved.put("icon","cloud");saved.put("category","Updated category");saved.put("technologies",List.of("Spring Boot","JavaScript"));
        saved.put("imageUrl","https://images.example.test/render?width=800&format=webp");saved.put("projectUrl","https://www.updated.example.test/path?q=1");
        saved.put("displayOrder",0);saved.put("featured",false);saved.put("concept",true);saved.put("active",false);
        var updated=mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(saved))).andExpect(status().isOk()).andReturn().getResponse();
        var values=json.readValue(updated.getContentAsString(),new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
        assertPortfolioFields(saved,values);
        // SQL timestamp columns store microseconds rather than Instant's nanoseconds.
        assertTrue(java.time.Duration.between(java.time.Instant.parse((String)saved.get("createdAt")),java.time.Instant.parse((String)values.get("createdAt"))).abs().compareTo(java.time.Duration.ofNanos(1000))<=0);
        assertEquals(1,values.get("version"));
        String loaded=mvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertPortfolioFields(values,json.readValue(loaded,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){}));
        String listed=mvc.perform(get("/api/admin/cms/portfolio")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertPortfolioFields(values,json.readValue(listed,new com.fasterxml.jackson.core.type.TypeReference<List<Map<String,Object>>>(){}).getFirst());
        var stored=projects.findById(((Number)saved.get("id")).longValue()).orElseThrow();
        assertEquals(values.get("projectUrl"),stored.getProjectUrl());assertEquals(values.get("imageUrl"),stored.getImageUrl());assertEquals(values.get("technologies"),stored.getTechnologies());
        mvc.perform(get("/api/portfolio/portfolio-round-trip")).andExpect(status().isNotFound());
        // Publication changes must retain URLs and every other field.
        values.put("active",true);values.put("featured",true);
        mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(values))).andExpect(status().isOk());
        mvc.perform(get("/api/portfolio")).andExpect(jsonPath("$[0].title").value("Updated project")).andExpect(jsonPath("$[0].projectUrl").value(values.get("projectUrl"))).andExpect(jsonPath("$[0].imageUrl").value(values.get("imageUrl"))).andExpect(jsonPath("$[0].featured").value(true));
        mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(values))).andExpect(status().isConflict());
    }
    private void assertPortfolioFields(Map<String,Object> expected,Map<String,Object> actual){
        for(String field:List.of("name","slug","shortDescription","description","icon","imageUrl","displayOrder","active","category","technologies","projectUrl","featured","concept"))assertEquals(expected.get(field),actual.get(field),field);
    }
    @Test @WithMockUser(roles="ADMIN") void portfolioOptionalFieldsArePreservedWhenOmittedAndCanBeCleared() throws Exception {
        var request=item("preserved-portfolio",true);request.put("category","Keep category");request.put("projectUrl","www.abc.com");request.put("imageUrl","assets/images/project.jpg");request.put("concept",false);
        var saved=create("portfolio",request);String path="/api/admin/cms/portfolio/"+saved.get("id");
        var omitted=new LinkedHashMap<>(saved);
        for(String field:List.of("imageUrl","category","technologies","projectUrl","featured","concept"))omitted.remove(field);
        omitted.put("name","Edited without optional fields");
        String result=mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(omitted))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var retained=json.readValue(result,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
        saved.put("name",omitted.get("name"));assertPortfolioFields(saved,retained);
        retained.put("imageUrl","");retained.put("projectUrl","");retained.put("category","");retained.put("technologies",List.of());retained.put("featured",false);retained.put("concept",false);
        mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(retained))).andExpect(status().isOk());
        var stored=projects.findById(((Number)saved.get("id")).longValue()).orElseThrow();
        assertNull(stored.getImageUrl());assertNull(stored.getProjectUrl());assertNull(stored.getCategory());assertTrue(stored.getTechnologies().isEmpty());assertFalse(stored.isFeatured());assertFalse(stored.isConcept());
        mvc.perform(get(path)).andExpect(jsonPath("$.imageUrl").isEmpty()).andExpect(jsonPath("$.projectUrl").isEmpty()).andExpect(jsonPath("$.technologies").isEmpty());
    }
    @Test @WithMockUser(roles="ADMIN") void portfolioUrlValidationAndStableInternalRouting() throws Exception {
        for(String url:List.of("www.abc.com","abc.com/path?x=1#demo","www.abc.com/index.html","https://www.abc.com","http://www.abc.com","/portfolio","contact.html")){
            var r=item("url-check-"+projects.count(),true);r.put("projectUrl",url);create("portfolio",r);
        }
        for(String image:List.of("images/project.jpg","/uploads/project.WEBP?v=2","https://images.example.test/render?w=100","http://example.test/project.png","https://example.test")){
            var r=item("image-check-"+projects.count(),true);r.put("imageUrl",image);create("portfolio",r);
        }
        for(String unsafe:List.of("javascript:alert(1)","data:text/html,test","//evil.example/path","https://user:pass@example.test/path","file:///private.png","https://example.test:99999/path")){
            var r=item("unsafe-url",true);r.put("projectUrl",unsafe);
            mvc.perform(post("/api/admin/cms/portfolio").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(r))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.projectUrl").exists());
        }
        for(String unsafe:List.of("../private.png","/images/../private.png","/images/%2e%2e/private.png","//example.test/image.png","https://example.test/payload.svg","/images/test.php")){
            var r=item("unsafe-image",true);r.put("imageUrl",unsafe);
            mvc.perform(post("/api/admin/cms/portfolio").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(r))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.imageUrl").exists());
        }
        var saved=create("portfolio",item("stable-portfolio",true));saved.put("slug","different-portfolio");
        mvc.perform(put("/api/admin/cms/portfolio/"+saved.get("id")).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(saved))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.slug").exists());
        mvc.perform(get("/api/portfolio/stable-portfolio")).andExpect(status().isOk());
    }
    @Test @WithMockUser(roles="ADMIN") void documentsValidationAndPublicUpdates() throws Exception {
        var document=content.get("home");Map<String,String> values=new LinkedHashMap<>(document.content());values.put("subtitle","Updated homepage content from the test database.");values.put("primaryCtaUrl","/contact");
        mvc.perform(put("/api/admin/content/home").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("version",document.version(),"content",values)))).andExpect(status().isOk());
        mvc.perform(get("/api/content/home")).andExpect(jsonPath("$.subtitle").value(values.get("subtitle")));
        values.put("primaryCtaUrl","javascript:alert(1)");var latest=content.get("home");
        mvc.perform(put("/api/admin/content/home").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("version",latest.version(),"content",values)))).andExpect(status().isBadRequest());
        values.put("primaryCtaUrl","contact.html");values.put("unsafeUnknown","x");
        mvc.perform(put("/api/admin/content/home").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("version",latest.version(),"content",values)))).andExpect(status().isBadRequest());
    }
    @Test void publicCorsAllowsOnlyConfiguredOrigins() throws Exception {
        mvc.perform(options("/api/services").header("Origin","http://localhost:8000").header("Access-Control-Request-Method","GET")).andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://localhost:8000"));
        mvc.perform(options("/api/services").header("Origin","https://untrusted.example").header("Access-Control-Request-Method","GET")).andExpect(status().isForbidden());
        mvc.perform(options("/api/admin/cms/services").header("Origin","http://localhost:8000").header("Access-Control-Request-Method","PUT")).andExpect(status().isForbidden());
    }
}
