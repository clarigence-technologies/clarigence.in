package in.clarigence.contactapi.repository;
import in.clarigence.contactapi.entity.PortfolioProject;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface PortfolioProjectRepository extends JpaRepository<PortfolioProject,Long> {
    List<PortfolioProject> findAllByOrderByDisplayOrderAscIdAsc();
    List<PortfolioProject> findByActiveTrueOrderByDisplayOrderAscIdAsc();
    Optional<PortfolioProject> findBySlugAndActiveTrue(String slug);
    Optional<PortfolioProject> findBySlug(String slug);
    boolean existsBySlug(String slug);
    boolean existsBySlugAndIdNot(String slug,Long id);
    long countByActiveTrue();
}
