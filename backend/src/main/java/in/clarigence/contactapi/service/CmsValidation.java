package in.clarigence.contactapi.service;
import in.clarigence.contactapi.exception.CmsValidationException;
import java.net.URI;

public final class CmsValidation {
    private CmsValidation(){}
    /** Website addresses and internal slugs are deliberately separate. */
    public static String projectUrl(String value){
        if(value==null || value.isBlank())return null;
        String normalized=value.trim();
        // Keep existing local page links, including contact.html, working.
        if(normalized.matches("(?i)(?:www\\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,63}(?::[0-9]{1,5})?(?:[/?#].*)?")
            && !normalized.matches("(?i)[a-z0-9_-]+\\.html(?:[?#].*)?"))normalized="https://"+normalized;
        if(normalized.matches(".*[\\s\\\\<>\"].*"))fail("projectUrl");
        try {
            URI uri=URI.create(normalized);
            if(uri.isAbsolute()){
                webUrl("projectUrl",uri);
            } else url("projectUrl",normalized,false);
        } catch(IllegalArgumentException error){fail("projectUrl");}
        if(normalized.length()>2048)throw new CmsValidationException("projectUrl","The complete URL must be at most 2048 characters.");
        return normalized;
    }
    private static void webUrl(String field,URI uri){
        if(!isWebScheme(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null || uri.getPort()>65535)fail(field);
    }
    private static boolean isWebScheme(String scheme){return "https".equalsIgnoreCase(scheme)||"http".equalsIgnoreCase(scheme);}
    public static void url(String field,String value,boolean image){
        if(value==null || value.isBlank())return;
        if(!value.equals(value.trim()) || value.matches(".*[\\s\\\\<>\"].*"))fail(field);
        try {
            URI uri=URI.create(value);
            if(uri.isAbsolute()){
                if(image)webUrl(field,uri);
                else if(!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null)fail(field);
                if(uri.getFragment()!=null && image)fail(field);
                // Image CDNs frequently use extensionless endpoints and query parameters.
                if(image && !uri.getPath().matches("(?i).*(?:\\.(png|jpe?g|webp|gif|avif)|/[^/.]*|^)$"))fail(field);
            } else {
                if(value.startsWith("//") || value.contains("..") || value.contains("%") || (!image && uri.getQuery()!=null) || (image && uri.getFragment()!=null))fail(field);
                if(image && !uri.getPath().matches("(?i)/?[a-z0-9_./-]+\\.(png|jpe?g|webp|gif|avif)"))fail(field);
                if(!image && !value.matches("(?:[a-zA-Z0-9/_-]+(?:\\.html)?)?(?:#[a-zA-Z0-9_-]+)?"))fail(field);
            }
        } catch(IllegalArgumentException error){fail(field);}
    }
    private static void fail(String field){throw new CmsValidationException(field,"projectUrl".equals(field)?"Use a website address (www.abc.com), an HTTP/HTTPS URL, or a safe local page path.":"Use a safe served image path or an HTTP/HTTPS image URL; page links must use HTTPS or a local path.");}
}
