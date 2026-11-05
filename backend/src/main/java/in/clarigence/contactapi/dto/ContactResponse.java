package in.clarigence.contactapi.dto;

import java.time.Instant;

public record ContactResponse(boolean success, Long id, String message, Instant createdAt) {
}
