package in.clarigence.contactapi.service;

import in.clarigence.contactapi.entity.Contact;
import in.clarigence.contactapi.dto.EnquiryDetails;
import in.clarigence.contactapi.exception.ResourceNotFoundException;
import in.clarigence.contactapi.repository.ContactRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class NotificationDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(NotificationDeliveryService.class);
    private final ContactRepository contacts;
    private final ObjectProvider<JavaMailSender> sender;
    private final boolean enabled;
    private final String recipient, from;
    public NotificationDeliveryService(ContactRepository contacts, ObjectProvider<JavaMailSender> sender,
            @Value("${clarigence.enquiry-email.enabled:false}") boolean enabled,
            @Value("${clarigence.enquiry-email.to:hello@clarigence.in}") String recipient,
            @Value("${clarigence.enquiry-email.from:}") String from) {
        this.contacts = contacts; this.sender = sender; this.enabled = enabled;
        this.recipient = recipient; this.from = from;
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public EnquiryDetails deliver(Long id) {
        Contact c = contacts.findForNotification(id).orElseThrow(() -> new ResourceNotFoundException("Enquiry not found."));
        // Serialize concurrent retries across instances using the database row lock.
        return deliverLocked(c);
    }
    private EnquiryDetails deliverLocked(Contact c) {
        if ("SENT".equals(c.getNotificationStatus())) return EnquiryDetails.from(c);
        if (!enabled) {
            c.recordNotification("DISABLED", "Notifications are disabled on the backend host.");
            return EnquiryDetails.from(c);
        }
        log.info("Email sending started for saved enquiry {}.", c.getId());
        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            mail.setTo(recipient); mail.setFrom(from); mail.setReplyTo(c.getEmail());
            mail.setSubject("New Clarigence enquiry #" + c.getId());
            mail.setText("""
                    A new website enquiry has been saved in the admin portal.

                    Enquiry ID: %s
                    Received (UTC): %s
                    Name: %s
                    Email: %s
                    Phone: %s
                    Company: %s
                    Service: %s

                    Message:
                    %s
                    """.formatted(c.getId(), c.getCreatedAt(), c.getName(), c.getEmail(), optional(c.getPhone()),
                        optional(c.getCompany()), c.getService(), c.getMessage()));
            sender.getObject().send(mail);
            c.recordNotification("SENT", null);
            log.info("Email sent successfully for enquiry {} (email provider accepted the message).", c.getId());
        } catch (RuntimeException e) {
            String diagnostic = MailFailureDiagnostic.describe(e);
            c.recordNotification("FAILED", diagnostic);
            log.error("Email sending failed for saved enquiry {}: type={}, diagnostic={}. Enquiry remains saved.",
                    c.getId(), e.getClass().getSimpleName(), diagnostic);
        }
        return EnquiryDetails.from(c);
    }
    private String optional(String s) { return s == null || s.isBlank() ? "Not provided" : s; }
}
