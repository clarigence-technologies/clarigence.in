package in.clarigence.contactapi.dto;

import in.clarigence.contactapi.entity.Contact;
import in.clarigence.contactapi.entity.ContactStatus;
import java.time.Instant;

public record EnquiryDetails(
        Long id,
        String name,
        String email,
        String phone,
        String company,
        String service,
        String message,
        ContactStatus status,
        Instant createdAt,
        String notificationStatus,
        Instant notificationAttemptedAt,
        String notificationError
) {
    public static EnquiryDetails from(Contact contact) {
        return new EnquiryDetails(contact.getId(), contact.getName(), contact.getEmail(), contact.getPhone(),
                contact.getCompany(), contact.getService(), contact.getMessage(), contact.getStatus(),
                contact.getCreatedAt(), contact.getNotificationStatus(), contact.getNotificationAttemptedAt(), contact.getNotificationError());
    }
}
