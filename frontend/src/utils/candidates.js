export function candidateName(candidate) {
  return candidate.surname && candidate.first_name
    ? [candidate.surname, candidate.first_name, candidate.middle_name].filter(Boolean).join(' ')
    : candidate.full_name
}
