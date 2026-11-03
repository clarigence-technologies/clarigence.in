package in.clarigence.contactapi.controller;

import in.clarigence.contactapi.dto.*;
import in.clarigence.contactapi.service.ClientService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @Validated
public class ClientController {
    private final ClientService clients;
    public ClientController(ClientService clients){this.clients=clients;}
    @GetMapping("/api/clients") public List<PublicClient> publicClients(){return clients.publicClients();}
    @GetMapping("/api/admin/clients") public List<AdminClient> list(){return clients.list();}
    @GetMapping("/api/admin/clients/{id}") public AdminClient get(@PathVariable @Min(1) Long id){return clients.get(id);}
    @PostMapping("/api/admin/clients") @ResponseStatus(HttpStatus.CREATED)
    public AdminClient create(@Valid @RequestBody ClientRequest request){return clients.save(null,request);}
    @PutMapping("/api/admin/clients/{id}") public AdminClient update(@PathVariable @Min(1) Long id,@Valid @RequestBody ClientRequest request){return clients.save(id,request);}
    @DeleteMapping("/api/admin/clients/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @Min(1) Long id){clients.delete(id);}
}
