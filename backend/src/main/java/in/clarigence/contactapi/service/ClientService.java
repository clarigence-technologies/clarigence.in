package in.clarigence.contactapi.service;

import in.clarigence.contactapi.dto.*;
import in.clarigence.contactapi.entity.ClientLogo;
import in.clarigence.contactapi.exception.*;
import in.clarigence.contactapi.repository.ClientLogoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service @Transactional(readOnly=true)
public class ClientService {
    private final ClientLogoRepository clients;
    public ClientService(ClientLogoRepository clients){this.clients=clients;}
    public List<PublicClient> publicClients(){return clients.findByActiveTrueOrderByDisplayOrderAscIdAsc().stream().map(PublicClient::from).toList();}
    public List<AdminClient> list(){return clients.findAllByOrderByDisplayOrderAscIdAsc().stream().map(AdminClient::from).toList();}
    public AdminClient get(Long id){return AdminClient.from(find(id));}
    public long activeCount(){return clients.countByActiveTrue();}
    private ClientLogo find(Long id){return clients.findById(id).orElseThrow(()->new ResourceNotFoundException("Client not found."));}
    @Transactional public AdminClient save(Long id,ClientRequest r){
        ClientLogo client=id==null?new ClientLogo():find(id);
        if(id!=null && !Objects.equals(client.getVersion(),r.version()))throw new CmsConflictException();
        String logo=r.logoUrl().trim();
        try{CmsValidation.url("imageUrl",logo,true);}catch(CmsValidationException e){throw new CmsValidationException("logoUrl","Use a served image path or an HTTP/HTTPS image URL.");}
        String website;
        try{website=CmsValidation.projectUrl(r.websiteUrl());}catch(CmsValidationException e){throw new CmsValidationException("websiteUrl","Use a website address (www.abc.com) or an HTTP/HTTPS URL.");}
        client.setName(r.name().trim());client.setLogoUrl(logo);client.setWebsiteUrl(website);
        client.setDisplayOrder(r.displayOrder());client.setActive(r.active());
        return AdminClient.from(clients.saveAndFlush(client));
    }
    @Transactional public void delete(Long id){clients.delete(find(id));}
}
