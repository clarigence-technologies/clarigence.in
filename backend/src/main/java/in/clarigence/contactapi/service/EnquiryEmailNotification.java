package in.clarigence.contactapi.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.*;

@Component
public class EnquiryEmailNotification {
    private static final Logger log = LoggerFactory.getLogger(EnquiryEmailNotification.class);
    private final NotificationDeliveryService delivery;
    public EnquiryEmailNotification(NotificationDeliveryService delivery) { this.delivery = delivery; }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void send(EnquiryCreated event) {
        try { delivery.deliver(event.contact().getId()); }
        catch (RuntimeException e) {
            log.error("Notification processing failed for saved enquiry {}: {}. Enquiry remains saved; admin can retry.",
                    event.contact().getId(), e.getClass().getSimpleName());
        }
    }
}
