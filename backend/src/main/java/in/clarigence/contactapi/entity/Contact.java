package in.clarigence.contactapi.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Index;
import java.time.Instant;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

@Entity
@Table(name = "contacts", indexes = @Index(name = "idx_contacts_status_created", columnList = "status, created_at"))
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(length = 30)
    private String phone;

    @Column(length = 160)
    private String company;

    @Column(name = "service_required", nullable = false, length = 120)
    private String service;

    @Column(nullable = false, length = 5000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20) default 'NEW'")
    private ContactStatus status = ContactStatus.NEW;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "submission_key", length = 36, unique = true)
    private String submissionKey;

    @Column(name = "notification_status", length = 20)
    private String notificationStatus;

    @Column(name = "notification_attempted_at")
    private Instant notificationAttemptedAt;

    @Column(name = "notification_error", length = 500)
    private String notificationError;

    public String getSubmissionKey() { return submissionKey; }
    public void setSubmissionKey(String key) { submissionKey = key; }
    public String getNotificationStatus() { return notificationStatus == null ? "NOT_ATTEMPTED" : notificationStatus; }
    public Instant getNotificationAttemptedAt() { return notificationAttemptedAt; }
    public String getNotificationError() { return notificationError; }
    public void recordNotification(String status, String error) {
        notificationStatus = status;
        notificationAttemptedAt = Instant.now();
        notificationError = error;
    }

    protected Contact() {
    }

    public Contact(String name, String email, String phone, String company, String service, String message) {
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.company = company;
        this.service = service;
        this.message = message;
    }

    @PrePersist
    void assignCreatedAt() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public String getCompany() { return company; }
    public String getService() { return service; }
    public String getMessage() { return message; }
    public ContactStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }

    public void setStatus(ContactStatus status) {
        this.status = status;
    }
}
