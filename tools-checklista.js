const KEY = "sailabc_checklist_v1";

const defaultItems = [
  "Kamizelki ratunkowe",
  "Koło ratunkowe",
  "Rakiety sygnałowe",
  "Gaśnice",
  "Apteczka",
  "Dokumenty jachtu",
  "Dokumenty załogi",
  "Mapa papierowa",
  "Latarka / czołówka",
  "Telefon + powerbank",
  "Sprawdzenie silnika",
  "Sprawdzenie paliwa",
  "Cumowanie i odbijacze",
  "Kotwica i łańcuch"
];

function loadChecklist(){
  const saved = JSON.parse(localStorage.getItem(KEY));
  return saved || defaultItems.map(i=>({name:i, checked:false}));
}

function saveChecklist(data){
  localStorage.setItem(KEY, JSON.stringify(data));
}

let checklistData = loadChecklist();
const container = document.getElementById("checklist");

function renderChecklist(){
  container.innerHTML = checklistData.map((item,i)=>`
    <div class="check-item">
      <input type="checkbox" data-i="${i}" ${item.checked ? "checked" : ""}>
      <span>${item.name}</span>
    </div>
  `).join("");
}

container.addEventListener("change", (e)=>{
  const i = e.target.dataset.i;
  checklistData[i].checked = e.target.checked;
  saveChecklist(checklistData);
});

document.getElementById("btnResetChecklist").addEventListener("click", ()=>{
  checklistData = defaultItems.map(i=>({name:i, checked:false}));
  saveChecklist(checklistData);
  renderChecklist();
});

renderChecklist();

/* ===== Kalkulator ===== */

document.getElementById("btnCalc").addEventListener("click", ()=>{
  const people = Number(document.getElementById("people").value);
  const days = Number(document.getElementById("days").value);
  const reserve = Number(document.getElementById("reserve").value)/100;

  const water = people * days * Number(document.getElementById("waterPerDay").value);
  const food = people * days * Number(document.getElementById("foodPerDay").value);
  const fuel = Number(document.getElementById("fuelPerHour").value) *
               Number(document.getElementById("engineHours").value);

  const totalWater = water * (1+reserve);
  const totalFood = food * (1+reserve);
  const totalFuel = fuel * (1+reserve);

  document.getElementById("resWater").textContent =
    totalWater.toFixed(1) + " l";

  document.getElementById("resFood").textContent =
    totalFood.toFixed(1) + " kg";

  document.getElementById("resFuel").textContent =
    totalFuel.toFixed(1) + " l";
});
