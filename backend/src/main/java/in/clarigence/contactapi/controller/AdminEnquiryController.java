package in.clarigence.contactapi.controller;

import in.clarigence.contactapi.dto.ContactStatusRequest;
import in.clarigence.contactapi.dto.DashboardSummary;
import in.clarigence.contactapi.dto.EnquiryDetails;
import in.clarigence.contactapi.dto.EnquiryPage;
import in.clarigence.contactapi.entity.ContactStatus;
import in.clarigence.contactapi.service.AdminEnquiryService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@Validated
public class AdminEnquiryController {

    private final AdminEnquiryService adminEnquiryService;
    private final in.clarigence.contactapi.service.NotificationDeliveryService delivery;

    public AdminEnquiryController(AdminEnquiryService adminEnquiryService, in.clarigence.contactapi.service.NotificationDeliveryService delivery) {
        this.adminEnquiryService = adminEnquiryService;
        this.delivery = delivery;
    }

    @GetMapping("/dashboard")
    public DashboardSummary dashboard() {
        return adminEnquiryService.dashboard();
    }

    @GetMapping("/enquiries")
    public EnquiryPage enquiries(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) ContactStatus status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return adminEnquiryService.search(query, status, page, size);
    }

    @GetMapping("/enquiries/{id}")
    public EnquiryDetails enquiry(@PathVariable @Min(1) Long id) {
        return adminEnquiryService.get(id);
    }

    @PutMapping("/enquiries/{id}/status")
    public EnquiryDetails updateStatus(@PathVariable @Min(1) Long id,
                                       @Valid @RequestBody ContactStatusRequest request) {
        return adminEnquiryService.updateStatus(id, request.status());
    }

    @org.springframework.web.bind.annotation.PostMapping("/enquiries/{id}/notification/retry")
    public EnquiryDetails retryNotification(@PathVariable @Min(1) Long id) {
        return delivery.deliver(id);
    }

    @DeleteMapping("/enquiries/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @Min(1) Long id) {
        adminEnquiryService.delete(id);
    }
}
