package in.clarigence.contactapi.dto;

import jakarta.validation.constraints.*;

public record ClientRequest(
    @NotBlank @Size(max=120) String name,
    @NotBlank @Size(max=2048) String logoUrl,
    @Size(max=2048) String websiteUrl,
    @NotNull @Min(0) @Max(100000) Integer displayOrder,
    @NotNull Boolean active,
    @Min(0) Long version
) {}
