package in.clarigence.contactapi.dto;

import jakarta.validation.constraints.*;

/** "Add to happy clients" switch on a portfolio project: show/hide its logo in the homepage clients strip. */
public record ProjectClientRequest(@NotNull Boolean show, @Size(max=2048) String logoUrl) {}
