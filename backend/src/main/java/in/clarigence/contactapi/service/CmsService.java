package in.clarigence.contactapi.service;
import in.clarigence.contactapi.dto.*;
import in.clarigence.contactapi.entity.*;
import in.clarigence.contactapi.exception.*;
import in.clarigence.contactapi.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service @Transactional(readOnly=true)
public class CmsService {
    private final WebsiteServiceRepository services;
    private final PortfolioProjectRepository projects;
    public CmsService(WebsiteServiceRepository services,PortfolioProjectRepository projects){this.services=services;this.projects=projects;}
    public List<ServiceSummary> publicServices(){return services.findByActiveTrueOrderByDisplayOrderAscIdAsc().stream().map(ServiceSummary::from).toList();}
    public PublicService publicService(String slug){return PublicService.from(services.findBySlugAndActiveTrue(slug).orElseThrow(()->new ResourceNotFoundException("Service not found.")));}
    public List<PublicProject> publicProjects(){return projects.findByActiveTrueOrderByDisplayOrderAscIdAsc().stream().map(PublicProject::from).toList();}
    public PublicProject publicProject(String slug){return PublicProject.from(projects.findBySlugAndActiveTrue(slug).orElseThrow(()->new ResourceNotFoundException("Project not found.")));}
    private boolean serviceKind(String kind){if("services".equals(kind))return true;if("portfolio".equals(kind))return false;throw new ResourceNotFoundException("Content module not found.");}
    public List<AdminCmsItem> list(String kind){return serviceKind(kind)?services.findAllByOrderByDisplayOrderAscIdAsc().stream().map(AdminCmsItem::from).toList():projects.findAllByOrderByDisplayOrderAscIdAsc().stream().map(AdminCmsItem::from).toList();}
    private CmsItem find(String kind,Long id){return serviceKind(kind)?services.findById(id).orElseThrow(()->new ResourceNotFoundException("Service not found.")):projects.findById(id).orElseThrow(()->new ResourceNotFoundException("Project not found."));}
    public AdminCmsItem get(String kind,Long id){return AdminCmsItem.from(find(kind,id));}
    public Map<String,Long> summary(){return Map.of("activeServices",services.countByActiveTrue(),"publishedProjects",projects.countByActiveTrue());}
    @Transactional public AdminCmsItem save(String kind,Long id,CmsItemRequest r){
        boolean service=serviceKind(kind);
        CmsItem item=id==null?(service?new WebsiteService():new PortfolioProject()):find(kind,id);
        if(id!=null && !Objects.equals(item.getVersion(),r.version()))throw new CmsConflictException();
        if(id!=null && !item.getSlug().equals(r.slug()))throw new CmsValidationException("slug","Published URLs are stable. Create a new record if a different slug is needed.");
        boolean duplicate=service?(id==null?services.existsBySlug(r.slug()):services.existsBySlugAndIdNot(r.slug(),id)):(id==null?projects.existsBySlug(r.slug()):projects.existsBySlugAndIdNot(r.slug(),id));
        if(duplicate)throw new CmsValidationException("slug","This slug is already in use.");
        CmsValidation.url("imageUrl",r.imageUrl(),true);
        String projectUrl=service?null:CmsValidation.projectUrl(r.projectUrl());
        item.setName(r.name().trim());item.setSlug(r.slug());item.setShortDescription(r.shortDescription().trim());item.setDescription(r.description().trim());
        item.setIcon(r.icon());if(id==null||r.imageUrl()!=null)item.setImageUrl(clean(r.imageUrl()));item.setDisplayOrder(r.displayOrder());item.setActive(r.active());
        if(item instanceof WebsiteService s){s.setCapabilities(list(r.capabilities()));s.setBenefits(list(r.benefits()));s.setUseCases(clean(r.useCases()));services.saveAndFlush(s);}
        if(item instanceof PortfolioProject p){
            // Older clients may omit optional fields. An explicit empty value clears them.
            if(id==null||r.category()!=null)p.setCategory(clean(r.category()));
            if(id==null||r.technologies()!=null)p.setTechnologies(list(r.technologies()));
            if(id==null||r.projectUrl()!=null)p.setProjectUrl(projectUrl);
            if(id==null||r.featured()!=null)p.setFeatured(Boolean.TRUE.equals(r.featured()));
            if(id==null||r.concept()!=null)p.setConcept(!Boolean.FALSE.equals(r.concept()));
            projects.saveAndFlush(p);
        }
        return AdminCmsItem.from(item);
    }
    @Transactional public void delete(String kind,Long id){CmsItem item=find(kind,id);if(item instanceof WebsiteService s)services.delete(s);else projects.delete((PortfolioProject)item);}
    private String clean(String text){return text==null||text.isBlank()?null:text.trim();}
    private List<String> list(List<String> values){return values==null?List.of():values.stream().map(String::trim).toList();}
}
