package in.clarigence.contactapi.entity;

import jakarta.persistence.*;

@Entity
@Table(name="portfolio_images")
public class PortfolioImage {
    @Id private String id;
    @Lob @Column(nullable=false, columnDefinition="MEDIUMBLOB") private byte[] data;
    protected PortfolioImage(){}
    public PortfolioImage(String id,byte[] data){this.id=id;this.data=data;}
    public byte[] getData(){return data;}
}
