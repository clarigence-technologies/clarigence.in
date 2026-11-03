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
    @Transactional public void initialize() throws Exception {
        if(!documents.existsById("cms-initialized")){
            try(var stream=new ClassPathResource("cms-seed.json").getInputStream()){
                JsonNode seed=json.readTree(stream);
                if(services.count()==0){for(JsonNode item:seed.get("services"))cms.save("services",null,json.treeToValue(item,CmsItemRequest.class));}
                // The seed mirrors the static content.json so a new database starts with the live site's content.
                if(projects.count()==0&&seed.has("portfolio")){for(JsonNode item:seed.get("portfolio"))cms.save("portfolio",null,json.treeToValue(item,CmsItemRequest.class));}
                if(clientLogos.count()==0&&seed.has("clients")){for(JsonNode item:seed.get("clients"))clients.save(null,json.treeToValue(item,ClientRequest.class));}
                for(var entry:seed.get("documents").properties()){
                    if(!documents.existsById(entry.getKey()))documents.save(new SiteDocument(entry.getKey(),json.writeValueAsString(entry.getValue())));
                }
                // Marker prevents resurrecting deliberately deleted services on future restarts.
                documents.saveAndFlush(new SiteDocument("cms-initialized","{}"));
            }
        }
        migrateLegacyBusinessEmail();
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
