package in.clarigence.contactapi.controller;

import in.clarigence.contactapi.dto.ContactRequest;
import in.clarigence.contactapi.dto.ContactResponse;
import in.clarigence.contactapi.service.ContactSubmissionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/contact")
public class ContactController {

    private final ContactSubmissionService contactService;

    public ContactController(ContactSubmissionService contactService) {
        this.contactService = contactService;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ContactResponse> createContact(@Valid @RequestBody ContactRequest request,
            @org.springframework.web.bind.annotation.RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return ResponseEntity.status(HttpStatus.CREATED).body(contactService.submit(request, key));
    }
}
