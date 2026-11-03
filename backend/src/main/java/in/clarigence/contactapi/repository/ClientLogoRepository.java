package in.clarigence.contactapi.repository;

import in.clarigence.contactapi.entity.ClientLogo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ClientLogoRepository extends JpaRepository<ClientLogo,Long> {
    List<ClientLogo> findAllByOrderByDisplayOrderAscIdAsc();
    List<ClientLogo> findByActiveTrueOrderByDisplayOrderAscIdAsc();
    long countByActiveTrue();
}
