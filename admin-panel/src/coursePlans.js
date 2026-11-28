import { loadAdminFeePlans } from './services/feePlanApi';

function setSelectMessage(select, message) {
  const option = select.ownerDocument.createElement('option');
  option.disabled = true;
  option.textContent = message;
  select.replaceChildren(option);
}

export function populateCoursePlanSelect(select, window) {
  setSelectMessage(select, 'Loading fee plans…');
  loadAdminFeePlans(window)
    .then((plans) => {
      select.replaceChildren();
      if (!plans.length) {
        setSelectMessage(select, 'No course plans available');
        return;
      }

      plans.forEach((plan) => {
        const option = select.ownerDocument.createElement('option');
        option.value = plan.id;
        option.textContent = plan.name;
        select.appendChild(option);
      });
    })
    .catch((error) => {
      console.error('Could not load fee plans for this page.', error);
      setSelectMessage(select, 'Fee plans could not be loaded. Check the API connection and try again.');
    });
}
