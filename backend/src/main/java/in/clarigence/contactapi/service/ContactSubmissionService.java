package in.clarigence.contactapi.service;

import in.clarigence.contactapi.dto.*;
import in.clarigence.contactapi.entity.Contact;
import in.clarigence.contactapi.repository.ContactRepository;
import in.clarigence.contactapi.exception.ContactPersistenceException;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class ContactSubmissionService {
    private final ContactService writer;
    private final ContactRepository contacts;
    public ContactSubmissionService(ContactService writer, ContactRepository contacts) {
        this.writer = writer; this.contacts = contacts;
    }
    public ContactResponse submit(ContactRequest request, String key) {
        if (key == null) return writer.create(request);
        try { java.util.UUID.fromString(key); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid submission key."); }
        if (key.length() != 36) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid submission key.");
        Contact existing = contacts.findBySubmissionKey(key).orElse(null);
        if (existing != null) return replay(existing, request);
        try { return writer.create(request, key); }
        catch (ContactPersistenceException e) {
            // A concurrent request can win the unique-key race. The writer's transaction
            // has rolled back before looking up the committed winner.
            existing = contacts.findBySubmissionKey(key).orElse(null);
            if (existing != null) return replay(existing, request);
            throw e;
        }
    }
    private ContactResponse replay(Contact c, ContactRequest r) {
        if (!Objects.equals(c.getName(), r.name().trim()) || !c.getEmail().equalsIgnoreCase(r.email().trim())
                || !Objects.equals(clean(c.getPhone()), clean(r.phone()))
                || !Objects.equals(clean(c.getCompany()), clean(r.company()))
                || !c.getService().equals(r.service().trim()) || !c.getMessage().equals(r.message().trim()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Submission key already used with different details.");
        return new ContactResponse(c.getId(), "Your enquiry has been received.", c.getCreatedAt());
    }
    private String clean(String s) { return s == null || s.isBlank() ? "" : s.trim(); }
}
