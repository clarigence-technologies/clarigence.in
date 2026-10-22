package in.clarigence.contactapi.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.util.StringUtils;

@Component
public class EmailConfigurationLogging {
    private static final Logger log = LoggerFactory.getLogger(EmailConfigurationLogging.class);
    private final Environment environment;

    public EmailConfigurationLogging(Environment environment) {
        this.environment = environment;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void logConfiguration() {
        boolean enabled = environment.getProperty("clarigence.enquiry-email.enabled", Boolean.class, false);
        if (!enabled) {
            log.info("Enquiry email notifications disabled; enquiries remain available in the admin dashboard.");
            return;
        }
        if ("resend".equals(environment.getProperty("clarigence.enquiry-email.provider", "smtp"))) {
            log.info("Resend HTTPS configuration loaded: apiKeyConfigured={}, senderConfigured={}, recipientConfigured={}",
                    configured("clarigence.enquiry-email.resend-api-key"), configured("clarigence.enquiry-email.from"),
                    configured("clarigence.enquiry-email.to"));
            return;
        }
        log.info("SMTP configuration loaded: host={}, port={}, auth={}, STARTTLS={}, STARTTLS-required={}, SSL={}, "
                        + "connectionTimeoutMs={}, readTimeoutMs={}, writeTimeoutMs={}, usernameConfigured={}, passwordConfigured={}, "
                        + "senderConfigured={}, recipientConfigured={}",
                setting("spring.mail.host"), setting("spring.mail.port"), setting("spring.mail.properties.mail.smtp.auth"),
                setting("spring.mail.properties.mail.smtp.starttls.enable"), setting("spring.mail.properties.mail.smtp.starttls.required"),
                environment.getProperty("spring.mail.properties.mail.smtp.ssl.enable", "false"),
                setting("spring.mail.properties.mail.smtp.connectiontimeout"), setting("spring.mail.properties.mail.smtp.timeout"),
                setting("spring.mail.properties.mail.smtp.writetimeout"), configured("spring.mail.username"),
                configured("spring.mail.password"), configured("clarigence.enquiry-email.from"), configured("clarigence.enquiry-email.to"));
        if (!configured("spring.mail.username") || !configured("spring.mail.password")) {
            log.error("SMTP credentials missing. Configure SMTP_USERNAME and SMTP_PASSWORD (or spring.mail overrides) on the backend host.");
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
    public void logSaved(EnquiryCreated event) {
        log.info("Enquiry {} saved successfully (database transaction committed).", event.contact().getId());
        if (!environment.getProperty("clarigence.enquiry-email.enabled", Boolean.class, false)) {
            log.info("Enquiry {} available in the admin dashboard; email notifications disabled.", event.contact().getId());
        }
    }

    private String setting(String name) { return environment.getProperty(name, "unset"); }
    private boolean configured(String name) { return StringUtils.hasText(environment.getProperty(name)); }
}
