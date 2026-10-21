package in.clarigence.contactapi.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ContactRequest(
        @NotBlank(message = "Name is required.")
        @Size(max = 120, message = "Name must be 120 characters or fewer.")
        String name,

        @NotBlank(message = "Email is required.")
        @Email(message = "Enter a valid email address.")
        @Size(max = 254, message = "Email must be 254 characters or fewer.")
        String email,

        @Pattern(regexp = "^$|^[+0-9() .-]{7,30}$", message = "Enter a valid phone number.")
        String phone,

        @Size(max = 160, message = "Company must be 160 characters or fewer.")
        String company,

        @NotBlank(message = "Please select a service.")
        @Size(max = 120, message = "Service must be 120 characters or fewer.")
        String service,

        @NotBlank(message = "Message is required.")
        @Size(min = 10, max = 5000, message = "Message must be between 10 and 5000 characters.")
        String message
) {
    public ContactRequest {
        name = trim(name);
        email = trim(email);
        phone = trim(phone);
        company = trim(company);
        service = trim(service);
        message = trim(message);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
