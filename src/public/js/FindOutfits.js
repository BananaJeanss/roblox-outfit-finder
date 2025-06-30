function formatAge(date) {
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  let months = now.getMonth() - date.getMonth();
  let days = now.getDate() - date.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  return `${years} years, ${months} months, ${days} days`;
}


async function findOutfits() {
  let username = document.getElementById("username").value.trim();
  const container = document.getElementById("outfits-container");
  const userContainer = document.getElementById("username-container");
  const userTitle = document.getElementById("username-title");
  const userImg = document.getElementById("user-thumbnail");
  const searchbutton = document.getElementById("search-button");
  const usernameInput = document.getElementById("username");
  const userId = document.getElementById("user-id");

  if (!username) {
    container.innerHTML = "<p>Please enter a username</p>";
    userContainer.style.display = "none";
    return;
  }

  // check for @ anywhere in username and remove it
  if (username.includes("@")) {
    username = username.replace(/@/g, "");
    document.getElementById("username").value = username;
  }

  // username validation
  container.innerHTML =
    '<div class="loading-p"><p>Loading outfits...</p><div class="loader"></div></div>';
  userContainer.style.display = "none";

  try {
    searchbutton.disabled = true;
    usernameInput.disabled = true;
    const response = await fetch(`/api/user/${username}`);
    const data = await response.json();

    if (!response.ok) {
      // if ratelimited/429
      if (response.status === 429) {
        container.innerHTML =
          "<p>Ratelimited, try again after 15 seconds (429)</p>";
        searchbutton.disabled = false;
        usernameInput.disabled = false;
      } else {
        // if any other error
        container.innerHTML = `<p>${data.error}</p>`;
        searchbutton.disabled = false;
        usernameInput.disabled = false;
      }
      return;
    }

    // update and show user info
    userTitle.textContent = `@${data.user.name} (${data.user.displayName})`;
    userId.textContent = `ID: ${data.user.id}`;

    // use headshotUrl from API (falls back to default if null)
    userImg.src = data.user.headshotUrl || "android-chrome-512x512.png";
    userContainer.style.display = "flex";

    const accountAgeEl = document.getElementById("account-age");
    if (data.user.created) {
      const createdDate = new Date(data.user.created);
      accountAgeEl.textContent = `Account Age: ${formatAge(createdDate)}`;
    }

    // no outfits found
    if (!data.outfits || data.outfits.length === 0) {
      container.innerHTML = "<p>No outfits found for this user</p>";
      searchbutton.disabled = false;
      usernameInput.disabled = false;
      return;
    }

    // display outfits
    displayOutfits(data.outfits);
    searchbutton.disabled = false;
    usernameInput.disabled = false;
  } catch (error) {
    // handle fetch errors
    console.error("Error fetching outfits:", error);
    container.innerHTML = "<p>Error loading outfits. Please try again.</p>";
    searchbutton.disabled = false;
    usernameInput.disabled = false;
  }
}

function displayOutfits(outfits) {
  const container = document.getElementById("outfits-container");
  const outfitsHTML = outfits
    .map(
      (outfit) => `
        <div class="outfit-card">
            ${
              outfit.thumbnailUrl
                ? `<img src="${outfit.thumbnailUrl}" alt="${outfit.name}" class="outfit-thumbnail">`
                : `<div class="outfit-placeholder"><p>${getPlaceholderText(
                    outfit.thumbnailState
                  )}</p></div>`
            }
            <h3>${outfit.name}</h3>
            <p>ID: ${outfit.id}</p>
        </div>
    `
    )
    .join("");

  container.innerHTML = `<div class="outfits-grid">${outfitsHTML}</div>`;
}

// thumbnail states
// pending means the thumbnail is still being generated
function getPlaceholderText(state) {
  switch (state) {
    case "Pending":
      return "Loading...";
    case "Error":
      return "Error";
    case "Blocked":
      return "Blocked";
    default:
      return "No Image";
  }
}
