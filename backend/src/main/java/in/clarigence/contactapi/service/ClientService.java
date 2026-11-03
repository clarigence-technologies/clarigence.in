package in.clarigence.contactapi.service;

import in.clarigence.contactapi.dto.*;
import in.clarigence.contactapi.entity.ClientLogo;
import in.clarigence.contactapi.entity.PortfolioProject;
import in.clarigence.contactapi.exception.*;
import in.clarigence.contactapi.repository.ClientLogoRepository;
import in.clarigence.contactapi.repository.PortfolioProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service @Transactional(readOnly=true)
public class ClientService {
    private final ClientLogoRepository clients;
    private final PortfolioProjectRepository projects;
    public ClientService(ClientLogoRepository clients,PortfolioProjectRepository projects){this.clients=clients;this.projects=projects;}

    /** Active logos; a logo linked to an unpublished (draft) project stays hidden until the project is published. */
    public List<PublicClient> publicClients(){
        return clients.findByActiveTrueOrderByDisplayOrderAscIdAsc().stream()
            .filter(c->c.getProjectSlug()==null||projects.findBySlugAndActiveTrue(c.getProjectSlug()).isPresent())
            .map(PublicClient::from).toList();
    }
    public List<AdminClient> list(){return clients.findAllByOrderByDisplayOrderAscIdAsc().stream().map(AdminClient::from).toList();}
    public AdminClient get(Long id){return AdminClient.from(find(id));}
    public long activeCount(){return clients.countByActiveTrue();}
    private ClientLogo find(Long id){return clients.findById(id).orElseThrow(()->new ResourceNotFoundException("Client not found."));}

    @Transactional public AdminClient save(Long id,ClientRequest r){
        ClientLogo client=id==null?new ClientLogo():find(id);
        if(id!=null && !Objects.equals(client.getVersion(),r.version()))throw new CmsConflictException();
        client.setName(r.name().trim());client.setLogoUrl(logo(r.logoUrl()));client.setWebsiteUrl(website(r.websiteUrl()));
        client.setDisplayOrder(r.displayOrder());client.setActive(r.active());
        return AdminClient.from(clients.saveAndFlush(client));
    }
    @Transactional public void delete(Long id){clients.delete(find(id));}

    /** The project's "Add to happy clients" switch: shows or hides its logo; the logo is kept for re-adding later. */
    @Transactional public Optional<AdminClient> setProjectClient(String slug,ProjectClientRequest r){
        PortfolioProject project=projects.findBySlug(slug).orElseThrow(()->new ResourceNotFoundException("Project not found."));
        ClientLogo client=clients.findByProjectSlug(slug).orElse(null);
        String logo=r.logoUrl()==null||r.logoUrl().isBlank()?null:logo(r.logoUrl().trim());
        if(!r.show()){
            if(client==null)return Optional.empty();
            if(logo!=null)client.setLogoUrl(logo);
            client.setActive(false);return Optional.of(AdminClient.from(clients.saveAndFlush(client)));
        }
        if(client==null){
            if(logo==null)throw new CmsValidationException("clientLogoUrl","Upload the client logo to show this project under Our happy clients.");
            client=new ClientLogo();client.setProjectSlug(slug);
            client.setDisplayOrder(project.getDisplayOrder());
        }
        if(logo!=null)client.setLogoUrl(logo);
        client.setName(project.getName());client.setWebsiteUrl(project.getProjectUrl());client.setActive(true);
        return Optional.of(AdminClient.from(clients.saveAndFlush(client)));
    }
    @Transactional public void deleteForProject(String slug){clients.findByProjectSlug(slug).ifPresent(clients::delete);}

    /** Links existing logos to the portfolio project with the same name (one-time migration). */
    @Transactional public void linkByProjectName(){
        for(ClientLogo client:clients.findAll()){
            if(client.getProjectSlug()!=null)continue;
            projects.findAll().stream().filter(p->p.getName().equalsIgnoreCase(client.getName().trim()))
                .filter(p->clients.findByProjectSlug(p.getSlug()).isEmpty()).findFirst()
                .ifPresent(p->{client.setProjectSlug(p.getSlug());clients.saveAndFlush(client);});
        }
    }

    private String logo(String value){
        String logo=value==null?"":value.trim();
        if(logo.isEmpty())throw new CmsValidationException("logoUrl","Upload a logo or enter a logo path.");
        try{CmsValidation.url("imageUrl",logo,true);}catch(CmsValidationException e){throw new CmsValidationException("logoUrl","Use a served image path or an HTTP/HTTPS image URL.");}
        return logo;
    }
    private String website(String value){
        try{return CmsValidation.projectUrl(value);}catch(CmsValidationException e){throw new CmsValidationException("websiteUrl","Use a website address (www.abc.com) or an HTTP/HTTPS URL.");}
    }
}
