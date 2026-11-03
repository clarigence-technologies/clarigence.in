package in.clarigence.contactapi.dto;

import in.clarigence.contactapi.entity.ClientLogo;

public record PublicClient(String name,String logoUrl,String websiteUrl) {
    public static PublicClient from(ClientLogo c){return new PublicClient(c.getName(),c.getLogoUrl(),c.getWebsiteUrl()==null?"":c.getWebsiteUrl());}
}
