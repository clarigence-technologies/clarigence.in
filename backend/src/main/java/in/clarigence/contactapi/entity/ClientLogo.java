package in.clarigence.contactapi.entity;

import jakarta.persistence.*;
import java.time.Instant;

/** A client logo shown in the homepage "Our happy clients" section. */
@Entity @Table(name="client_logos")
public class ClientLogo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Version private Long version;
    @Column(nullable=false, length=120) private String name;
    @Column(nullable=false, length=2048) private String logoUrl;
    @Column(length=2048) private String websiteUrl;
    @Column(nullable=false) private int displayOrder;
    @Column(nullable=false) private boolean active;
    @Column(nullable=false, updatable=false) private Instant createdAt;
    @Column(nullable=false) private Instant updatedAt;

    @PrePersist void createAudit() { createdAt=Instant.now(); updatedAt=createdAt; }
    @PreUpdate void updateAudit() { updatedAt=Instant.now(); }
    public Long getId(){return id;}
    public Long getVersion(){return version;}
    public String getName(){return name;}
    public void setName(String value){name=value;}
    public String getLogoUrl(){return logoUrl;}
    public void setLogoUrl(String value){logoUrl=value;}
    public String getWebsiteUrl(){return websiteUrl;}
    public void setWebsiteUrl(String value){websiteUrl=value;}
    public int getDisplayOrder(){return displayOrder;}
    public void setDisplayOrder(int value){displayOrder=value;}
    public boolean isActive(){return active;}
    public void setActive(boolean value){active=value;}
    public Instant getCreatedAt(){return createdAt;}
    public Instant getUpdatedAt(){return updatedAt;}
}
