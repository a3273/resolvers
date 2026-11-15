# Resolvers - Multi-Provider Stream Resolver

Worker Cloudflare monolitico che risolve stream da NTV, Vavoo e Matchora/HTSport.

## Endpoint

- `/live?ch=<slug|id>` - Playlist HLS (usa `&direct=1` per segmenti diretti)
- `/probe?ch=<slug>` - Diagnostica completa dei 3 provider
- `/ch` - Lista canali disponibili
- `/debug` - Stato cache e log
- `/ip` - IP egress del worker

## Canali

Vedi `/ch` per la lista completa.

## Uso in VLC
