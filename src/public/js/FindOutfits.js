async function findOutfits() {
  const username = document.getElementById("username").value.trim();
  const container = document.getElementById("outfits-container");

  if (!username) {
    container.innerHTML = "<p>Please enter a username</p>";
    return;
  }

  container.innerHTML = "<p>Loading outfits...</p>";

  try {
    const response = await fetch(`/api/user/${username}`);
    const data = await response.json();

    if (!response.ok) {
      // if ratelimited/429
      if (response.status === 429) {
        container.innerHTML =
          "<p>Ratelimited, try again after 15 seconds (429)</p>";
        return;
      }
      // if any other error
      container.innerHTML = `<p>${data.error}</p>`;
      return;
    }

    // no outfits found
    if (!data.outfits || data.outfits.length === 0) {
      container.innerHTML = "<p>No outfits found for this user</p>";
      return;
    }

    // display outfits
    displayOutfits(data.outfits);
  } catch (error) {
    // handle fetch errors
    console.error("Error fetching outfits:", error);
    container.innerHTML = "<p>Error loading outfits. Please try again.</p>";
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
