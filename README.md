service_maker_cli
=================

> Command line client for the Service Maker service.

## Usage
```
sm_cli [options] [command]
```
#### Commands
_login_
  
Acquire a new access token.

_signup_
  
Register a new user and acquire a new access token

_services_
  
List the available services.

_set-url_
  
Change service_maker base url

_service-create_
  
Create a new service instance.
  
Use options to pass parameters

`-c, --credential <name>=<value>` for credential parameter

`-o, --option <name>=<value>` for option


_types_
List the available service types.
Use `-v, --verbose` for verbose output.



#### Examples

```
    $ sm_cli types -v #detailed list of types and providers
    $ sm_cli service-create host:oceano -c clientId=do-client-id -c apiKey=do-api-key -o name=myVPS # create instance of provider 'oceano' of type 'host'
```