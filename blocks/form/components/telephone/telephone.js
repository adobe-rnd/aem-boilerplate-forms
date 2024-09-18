export default async function decorate(telephoneDiv) {
  const input = telephoneDiv.querySelector('input');
  input.type = 'tel';
  return telephoneDiv;
}
