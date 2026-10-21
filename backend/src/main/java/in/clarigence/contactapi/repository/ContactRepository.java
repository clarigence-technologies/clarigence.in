package in.clarigence.contactapi.repository;

import in.clarigence.contactapi.entity.Contact;
import in.clarigence.contactapi.entity.ContactStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ContactRepository extends JpaRepository<Contact, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Contact c WHERE c.id = :id")
    java.util.Optional<Contact> findForNotification(@Param("id") Long id);

    java.util.Optional<Contact> findBySubmissionKey(String submissionKey);

    @Query("""
            SELECT c FROM Contact c
            WHERE (:status IS NULL OR c.status = :status)
              AND (:query IS NULL OR
                   LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) OR
                   LOWER(c.email) LIKE LOWER(CONCAT('%', :query, '%')) OR
                   LOWER(COALESCE(c.company, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR
                   LOWER(c.service) LIKE LOWER(CONCAT('%', :query, '%')) OR
                   LOWER(c.message) LIKE LOWER(CONCAT('%', :query, '%')))
            """)
    Page<Contact> search(@Param("query") String query,
                         @Param("status") ContactStatus status,
                         Pageable pageable);

    @Query("SELECT c.status AS status, COUNT(c) AS total FROM Contact c GROUP BY c.status")
    List<ContactStatusCount> countByStatus();

    interface ContactStatusCount {
        ContactStatus getStatus();
        long getTotal();
    }
}
