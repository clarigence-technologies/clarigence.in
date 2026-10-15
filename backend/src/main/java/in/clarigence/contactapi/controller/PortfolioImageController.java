package in.clarigence.contactapi.controller;

import in.clarigence.contactapi.entity.PortfolioImage;
import in.clarigence.contactapi.repository.PortfolioImageRepository;
import in.clarigence.contactapi.exception.CmsValidationException;
import in.clarigence.contactapi.exception.ResourceNotFoundException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import java.io.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

@RestController
public class PortfolioImageController {
    private final PortfolioImageRepository images;
    public PortfolioImageController(PortfolioImageRepository images){this.images=images;}

    @PostMapping(value="/api/admin/cms/portfolio/images",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String,String> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if(file.isEmpty() || file.getSize()>5*1024*1024)throw invalid("Choose a PNG, JPEG or GIF photo up to 5 MB.");
        byte[] bytes=file.getBytes();
        String format;
        try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
            var readers=ImageIO.getImageReaders(stream);
            if(!readers.hasNext())throw invalid("Choose a valid PNG, JPEG or GIF photo.");
            var reader=readers.next();
            try {
                reader.setInput(stream);
                format=reader.getFormatName().toLowerCase(Locale.ROOT);
                if(!Set.of("png","jpeg","gif").contains(format))throw invalid("Choose a PNG, JPEG or GIF photo.");
                if((long)reader.getWidth(0)*reader.getHeight(0)>16000000)throw invalid("Choose a photo with at most 16 million pixels.");
                if(reader.read(0)==null)throw invalid("This photo could not be read.");
            } finally {reader.dispose();}
        } catch(IOException | IllegalArgumentException error){throw invalid("This photo could not be read. Choose a valid PNG, JPEG or GIF photo.");}
        String id=UUID.randomUUID()+"."+(format.equals("jpeg")?"jpg":format);
        images.save(new PortfolioImage(id,bytes));
        return Map.of("imageUrl","/api/portfolio/images/"+id);
    }

    @GetMapping("/api/portfolio/images/{id}")
    public ResponseEntity<byte[]> image(@PathVariable String id){
        var image=images.findById(id).orElseThrow(()->new ResourceNotFoundException("Photo not found."));
        MediaType type=id.endsWith(".png")?MediaType.IMAGE_PNG:id.endsWith(".gif")?MediaType.IMAGE_GIF:MediaType.IMAGE_JPEG;
        return ResponseEntity.ok().contentType(type).cacheControl(CacheControl.maxAge(365,TimeUnit.DAYS).cachePublic())
            .header("X-Content-Type-Options","nosniff").body(image.getData());
    }
    private CmsValidationException invalid(String message){return new CmsValidationException("photo",message);}
}
