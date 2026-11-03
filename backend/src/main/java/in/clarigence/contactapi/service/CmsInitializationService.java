package in.clarigence.contactapi.service;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.clarigence.contactapi.dto.ClientRequest;
import in.clarigence.contactapi.dto.CmsItemRequest;
import in.clarigence.contactapi.entity.SiteDocument;
import in.clarigence.contactapi.repository.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CmsInitializationService {
    private static final String BUSINESS_EMAIL_MIGRATION="business-email-corrected-v2";
    private final WebsiteServiceRepository services;
    private final PortfolioProjectRepository projects;
    private final ClientLogoRepository clientLogos;
    private final ClientService clients;
    private final SiteDocumentRepository documents;
    private final CmsService cms;
    private final ObjectMapper json;
    public CmsInitializationService(WebsiteServiceRepository services,PortfolioProjectRepository projects,ClientLogoRepository clientLogos,ClientService clients,SiteDocumentRepository documents,CmsService cms,ObjectMapper json){this.services=services;this.projects=projects;this.clientLogos=clientLogos;this.clients=clients;this.documents=documents;this.cms=cms;this.json=json;}
    private static final String CONTENT_IMPORT_MIGRATION="content-import-v1";
    private JsonNode seed() throws Exception {try(var stream=new ClassPathResource("cms-seed.json").getInputStream()){return json.readTree(stream);}}
    @Transactional public void initialize() throws Exception {
        if(!documents.existsById("cms-initialized")){
            JsonNode seed=seed();
            if(services.count()==0){for(JsonNode item:seed.get("services"))cms.save("services",null,json.treeToValue(item,CmsItemRequest.class));}
            importPortfolioAndClients(seed);
            for(var entry:seed.get("documents").properties()){
                if(!documents.existsById(entry.getKey()))documents.save(new SiteDocument(entry.getKey(),json.writeValueAsString(entry.getValue())));
            }
            // Markers prevent resurrecting deliberately deleted records on future restarts.
            documents.saveAndFlush(new SiteDocument(CONTENT_IMPORT_MIGRATION,"{}"));
            documents.saveAndFlush(new SiteDocument("cms-initialized","{}"));
        }
        migrateContentImport();
        migrateLegacyBusinessEmail();
    }
    // The seed mirrors the static content.json, so the database starts with the live site's portfolio and clients.
    private void importPortfolioAndClients(JsonNode seed) throws Exception {
        if(projects.count()==0&&seed.has("portfolio")){for(JsonNode item:seed.get("portfolio"))cms.save("portfolio",null,json.treeToValue(item,CmsItemRequest.class));}
        if(clientLogos.count()==0&&seed.has("clients")){for(JsonNode item:seed.get("clients"))clients.save(null,json.treeToValue(item,ClientRequest.class));}
    }
    /** Databases created before portfolio/client seeding receive the live content once; empty modules only. */
    private void migrateContentImport() throws Exception {
        if(documents.existsById(CONTENT_IMPORT_MIGRATION))return;
        documents.saveAndFlush(new SiteDocument(CONTENT_IMPORT_MIGRATION,"{}"));
        importPortfolioAndClients(seed());
    }
    private void migrateLegacyBusinessEmail() throws Exception {
        if(documents.existsById(BUSINESS_EMAIL_MIGRATION))return;
        var business=documents.findById("business").orElse(null);
        if(business==null)return;
        // Claim this migration before updating business. The unique key serializes concurrent startup attempts.
        documents.saveAndFlush(new SiteDocument(BUSINESS_EMAIL_MIGRATION,"{}"));
        JsonNode content=json.readTree(business.getContentJson());
        if(!(content instanceof ObjectNode values))throw new IllegalStateException("Invalid stored business content");
        JsonNode email=values.get("email");
        if(email==null||!email.isTextual()||!("clarigence@gmail.com".equals(email.textValue())
                ||"hello@clargience.in".equals(email.textValue())))return;
        values.put("email","hello@clarigence.in");
        business.setContentJson(json.writeValueAsString(values));
        documents.saveAndFlush(business);
    }
}
