package in.clarigence.contactapi;

import in.clarigence.contactapi.entity.Contact;
import in.clarigence.contactapi.repository.ContactRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import java.nio.file.Path;
import static org.assertj.core.api.Assertions.assertThat;

class EnquiryRestartPersistenceTest {
    @TempDir Path directory;
    @Test void enquirySurvivesApplicationRestart() {
        String url = "jdbc:h2:file:" + directory.resolve("persistent").toAbsolutePath().toString().replace('\\', '/')
                + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE";
        Long id;
        try (var app = start(url)) {
            var contacts = app.getBean(ContactRepository.class);
            id = contacts.saveAndFlush(new Contact("Restart Test", "restart@example.com", "+91 90000 00000",
                    "Example", "Website Development", "Persist this enquiry across application restarts.")).getId();
        }
        try (var app = start(url)) {
            var saved = app.getBean(ContactRepository.class).findById(id).orElseThrow();
            assertThat(saved.getName()).isEqualTo("Restart Test");
            assertThat(saved.getCreatedAt()).isNotNull();
        }
    }
    private ConfigurableApplicationContext start(String url) {
        return new SpringApplicationBuilder(ContactApiApplication.class).profiles("test").run(
                "--server.port=0", "--spring.datasource.url=" + url,
                "--spring.jpa.hibernate.ddl-auto=update", "--clarigence.enquiry-email.enabled=false");
    }
}
