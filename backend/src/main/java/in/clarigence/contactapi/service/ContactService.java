package in.clarigence.contactapi.service;

import in.clarigence.contactapi.dto.ContactRequest;
import in.clarigence.contactapi.dto.ContactResponse;
import in.clarigence.contactapi.entity.Contact;
import in.clarigence.contactapi.exception.ContactPersistenceException;
import in.clarigence.contactapi.repository.ContactRepository;
import java.util.Locale;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContactService {

    private final ContactRepository contactRepository;
    private final ApplicationEventPublisher events;

    public ContactService(ContactRepository contactRepository, ApplicationEventPublisher events) {
        this.contactRepository = contactRepository;
        this.events = events;
    }

    @Transactional
    public ContactResponse create(ContactRequest request) {
        return create(request, null);
    }

    @Transactional
    public ContactResponse create(ContactRequest request, String submissionKey) {
        Contact contact = new Contact(
                request.name().trim(),
                request.email().trim().toLowerCase(Locale.ROOT),
                cleanOptional(request.phone()),
                cleanOptional(request.company()),
                request.service().trim(),
                request.message().trim()
        );

        contact.setSubmissionKey(submissionKey);
        try {
            Contact saved = contactRepository.saveAndFlush(contact);
            events.publishEvent(new EnquiryCreated(saved));
            return new ContactResponse(saved.getId(), "Your enquiry has been received.", saved.getCreatedAt());
        } catch (DataAccessException exception) {
            throw new ContactPersistenceException("We could not save your enquiry right now.", exception);
        }
    }

    private String cleanOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
