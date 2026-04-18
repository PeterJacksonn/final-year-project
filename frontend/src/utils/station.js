export function stationName(s) {
  return s?.['https://uri.etsi.org/ngsi-ld/name']?.value
    || s?.name?.value
    || s?.eaNotation?.value
    || s?.id?.split(':').pop()
    || 'Unknown Station'
}

export function stationNotation(s) {
  return s?.eaNotation?.value || s?.id?.split(':').pop()
}
