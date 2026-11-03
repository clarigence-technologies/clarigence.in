package in.clarigence.contactapi.repository;

import in.clarigence.contactapi.entity.ClientLogo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ClientLogoRepository extends JpaRepository<ClientLogo,Long> {
    List<ClientLogo> findAllByOrderByDisplayOrderAscIdAsc();
    List<ClientLogo> findByActiveTrueOrderByDisplayOrderAscIdAsc();
    Optional<ClientLogo> findByProjectSlug(String projectSlug);
    long countByActiveTrue();
}
