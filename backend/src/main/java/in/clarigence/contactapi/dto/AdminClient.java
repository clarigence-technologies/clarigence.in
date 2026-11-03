package in.clarigence.contactapi.dto;

import in.clarigence.contactapi.entity.ClientLogo;
import java.time.Instant;

public record AdminClient(Long id,Long version,String name,String logoUrl,String websiteUrl,int displayOrder,boolean active,Instant createdAt,Instant updatedAt) {
    public static AdminClient from(ClientLogo c){return new AdminClient(c.getId(),c.getVersion(),c.getName(),c.getLogoUrl(),c.getWebsiteUrl(),c.getDisplayOrder(),c.isActive(),c.getCreatedAt(),c.getUpdatedAt());}
}
