/**
 *   Twitch Top 100 Hispano
 *  @summary Muestra los 100 canales más vistos de Twitch que emiten en castellano.
 *  @author J. Rai <jraicr@gmail.com>
 *
 *  @todo  - Quedó pendiente refactorizar mejor las responsabilidades de las funciones y separar en modulos algunas funcionalidades.
 *        - También se ha dejado de cachear algunos querySelectors que habría que hacer en sólo una ocasión durante el inicio de la
 *          aplicación en la función cacheElements
 *
 */

import { RaiNodeHelper } from "./RaiNodeHelper.js";
import offlineThumb from "@/assets/pics/offline.webp";

const APP_DEBUG = true;
const clientId = import.meta.env.VITE_CLIENT_ID;
const clientSecret = import.meta.env.VITE_CLIENT_SECRET;

const eyeIconSVGPath =
  "M.5 7.5l-.464-.186a.5.5 0 000 .372L.5 7.5zm14 0l.464.186a.5.5 0 000-.372L14.5 7.5zm-7 4.5c-2.314 0-3.939-1.152-5.003-2.334a9.368 9.368 0 01-1.449-2.164 5.065 5.065 0 01-.08-.18l-.004-.007v-.001L.5 7.5l-.464.186v.002l.003.004a2.107 2.107 0 00.026.063l.078.173a10.368 10.368 0 001.61 2.406C2.94 11.652 4.814 13 7.5 13v-1zm-7-4.5l.464.186.004-.008a2.62 2.62 0 01.08-.18 9.368 9.368 0 011.449-2.164C3.56 4.152 5.186 3 7.5 3V2C4.814 2 2.939 3.348 1.753 4.666a10.367 10.367 0 00-1.61 2.406 6.05 6.05 0 00-.104.236l-.002.004v.001H.035L.5 7.5zm7-4.5c2.314 0 3.939 1.152 5.003 2.334a9.37 9.37 0 011.449 2.164 4.705 4.705 0 01.08.18l.004.007v.001L14.5 7.5l.464-.186v-.002l-.003-.004a.656.656 0 00-.026-.063 9.094 9.094 0 00-.39-.773 10.365 10.365 0 00-1.298-1.806C12.06 3.348 10.186 2 7.5 2v1zm7 4.5a68.887 68.887 0 01-.464-.186l-.003.008-.015.035-.066.145a9.37 9.37 0 01-1.449 2.164C11.44 10.848 9.814 12 7.5 12v1c2.686 0 4.561-1.348 5.747-2.665a10.366 10.366 0 001.61-2.407 6.164 6.164 0 00.104-.236l.002-.004v-.001h.001L14.5 7.5zM7.5 9A1.5 1.5 0 016 7.5H5A2.5 2.5 0 007.5 10V9zM9 7.5A1.5 1.5 0 017.5 9v1A2.5 2.5 0 0010 7.5H9zM7.5 6A1.5 1.5 0 019 7.5h1A2.5 2.5 0 007.5 5v1zm0-1A2.5 2.5 0 005 7.5h1A1.5 1.5 0 017.5 6V5z";

let streamsDataList;
let player;
let currentHighlightedStream;
let searchBox;
let searchInputField;
let backTopButton;
let streamsHTMLContainers = [];
let favouritesHTMLContainers = [];
let favouritesOfflineHTMLContainers = [];
let favouriteList = [];

init();

/**
 * Inicialización de aplicación
 */
function init() {
  cacheElements();
  manageEventHandlers();
  getTwitchStreams().then((streams) => {
    /**
     * Creamos video de directo embebido de Twitch y le pasamos el primer elemento de la lista
     * de streamers porque es el que más viewers tiene, por lo que sería el streamer activo en
     * la parte superior inicialmente.
     */
    const firstElementUser = streams.data[0].user_name;
    createTwitchEmbebedVideo(832, 468, firstElementUser, "twitch-embebed-live");

    renderTotalViewers(streams);

    hideLoadingAnimation();

    renderFavouriteStreams().then((favsHTMLData) => {
      favouritesHTMLContainers = favsHTMLData;
      initDebug();
    });

    showHiddenElements();
  });

  // Rescatamos los favoritos que estén guardados en Local Storage desde el inicio de la aplicación
  favouriteList = getAllFavourites();
}

async function getTwitchStreams() {
  const streams = await getAPIData(
    "https://api.twitch.tv/helix/streams?language=es&first=100"
  );

  if (streams !== undefined && !streams.error) {
    streamsDataList = streams.data;
    hideLoadingAnimation();

    const streamsWrapper = document.querySelector("#mosaic-streams");
    streamsHTMLContainers = renderStreams(streams.data, streamsWrapper);
  }

  return streams;
}

function initDebug() {
  if (APP_DEBUG) {
    // Expongo al ámbito global para poder usar desde la terminal del navegador durante el desarrollo
    window.RaiNodeHelper = RaiNodeHelper;
    window.streamsDataList = streamsDataList;
    window.streamsHTMLContainers = streamsHTMLContainers;
    window.favouritesHTMLContainers = favouritesHTMLContainers;
    window.favouriteList = favouriteList;

    window.getAllFavourites = getAllFavourites;
    window.removeContainers = removeContainers;
    window.showLoadingAnimation = showLoadingAnimation;
    window.hideLoadingAnimation = hideLoadingAnimation;
  }
}

function cacheElements() {
  searchInputField = document.querySelector(".input-search");
  searchBox = document.querySelector(".search-box");

  backTopButton = document.querySelector(".back-top-button");
}

function manageEventHandlers() {
  // Botón de scroll para volver a la parte superior de la web
  window.addEventListener("scroll", trackScroll);
  backTopButton.addEventListener("click", scrollToTop);

  // Boton de busqueda y filtro
  searchInputField.addEventListener("click", searchButtonClickHandler);
  searchInputField.addEventListener("input", (e) => {
    updateStreamsContainersFilterByUsername(e);
  });

  searchBox.addEventListener("click", (e) => {
    const clickSimulation = new Event("click");
    searchInputField.dispatchEvent(clickSimulation);
  });
}

/**
 *
 * @returns
 */
async function getTwitchAuthorization() {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;

  return fetch(url, {
    method: "POST",
  })
    .then((res) => res.json())

    .then((data) => data)

    .catch((error) => {
      hideLoadingAnimation();
      const errorMsg = "Fallo en API de autenticación.";
      displayErrorMessage(document.querySelector(".content-wrapper"), errorMsg);

      // Devolvemos el mensaje en forma de error en la consola (TypeError: failed to fetch)
      console.error(error);
      return error;
    });
}

/**
 *
 * @returns
 */
async function getAPIData(apiEndpoint) {
  const endpoint = apiEndpoint;

  // Simular error HTTP 400 respondido por el servidor de la API
  // const endpoint = "https://api.twitch.tv/helix/streams?language=es&first=101";

  // Simular error HTPP 404 respondido por el servidor de la API
  // const endpoint = "https://api.twitch.tv/helix/hola";

  // Simular dominio que no resuelve y sin respuesta del servidor.
  // const endpoint = "http://dominioinventado.com";

  // Nos aseguramos de esperar hasta que se resuelva nuestro objeto con los datos de autenticación
  const authorizationObject = await getTwitchAuthorization();
  let {
    access_token: accessToken,
    // expires_in: expiresIn,
    token_type: tokenType,
  } = authorizationObject;

  // Reescribimos token_type ya que la primera letra debe empezar por mayúsculas
  tokenType =
    tokenType.substring(0, 1).toUpperCase() +
    tokenType.substring(1, tokenType.length);

  // Construimos nuestro token de autorización
  const authorization = `${tokenType} ${accessToken}`;

  const headers = {
    authorization,
    "Client-Id": clientId,
  };

  return fetch(endpoint, {
    headers,
  })
    .then((res) => {
      if (!res.ok) {
        // console.debug(`HTTP Status: ${res.status}`);

        // Mostrar un aviso en la UI diciendo que no se puede realizar conexión con Twitch
        manageStatusError(res.status);
        const errorMsg = `Error HTTP ${res.status}`;
        displayErrorMessage(
          document.querySelector(".content-wrapper"),
          errorMsg
        );
      }

      return res.json();
    })

    .then((streams) => streams)

    .catch((error) => {
      const consoleErrorStr = `Sin respuesta del servidor:\n ${endpoint}`;
      const separator = ": ";
      const consoleVerboseErrorStr = consoleErrorStr + separator + error;

      // a veces la promesa se rechaza y no devuelve el error
      const outputError =
        error !== undefined ? consoleErrorStr : consoleVerboseErrorStr;

      // console.error(outputError);
      displayErrorMessage(
        document.querySelector(".content-wrapper"),
        `${outputError}`
      );
      hideLoadingAnimation();
    });
}

/**
 *
 * @param {Array} data
 */
function renderTotalViewers(data) {
  const viewersPerStream = [];

  const { data: streams } = data;

  streams.forEach((stream) => {
    viewersPerStream.push(stream.viewer_count);
  });

  const contentTitleContainer = document.querySelector(".content-title");
  const h3Element = document.createElement("h3");

  const totalViewers = calculateTotalViewers(viewersPerStream);
  h3Element.innerText = `${totalViewers
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")} usuarios`;

  contentTitleContainer.appendChild(h3Element);
}

function manageStatusError(httpStatus) {
  console.log(
    `Error ${httpStatus} Esta aplicación no puede funcionar en este momento.`
  );
  hideLoadingAnimation();
}

function renderChannelsInfo(channelsData, container) {
  const streamsContainers = [];

  // Utilizamos .map() para renderizar cada stream recibido por la API
  channelsData.map((channelData) => {
    const streamContainer = document.createElement("div");
    streamContainer.classList.add("stream-container-offline");

    renderChannelInfo(streamContainer, channelData);
    streamsContainers.push(streamContainer);
    return container.appendChild(streamContainer);
  });

  return streamsContainers;
}

function renderChannelInfo(container, channelData) {
  const { broadcaster_name: broadcasterName } = channelData;

  const streamThumbImgElement = RaiNodeHelper.createImg(
    offlineThumb,
    `${broadcasterName} está desconectado.`
  );

  const streamTitleElement = RaiNodeHelper.createTitle("h2", broadcasterName);
  // let streamTitleElement = RaiNodeHelper.createTitle("h2", title);

  // let streamUserParagrapElement = RaiNodeHelper.createParagraph(broadcaster_name, ["grey-text", "remark-text"]);

  // Añadimos los elementos al contenedor
  container.appendChild(streamThumbImgElement);
  container.appendChild(streamTitleElement);
  // container.appendChild(streamUserParagrapElement);
}

/**
 * Renderiza un listado de streams
 * @param {*} data  El listado de stream
 */
function renderStreams(streamsData, container, createMenu = true) {
  const streamsContainers = [];

  // Utilizamos .map() para renderizar cada stream recibido por la API
  streamsData.map((stream, index) => {
    const streamContainer = document.createElement("div");
    streamContainer.classList.add("stream-container");
    streamContainer.setAttribute("tabindex", "0");

    renderStream(streamContainer, stream, createMenu);
    streamsContainers.push(streamContainer);
    container.appendChild(streamContainer);

    return streamContainer;
  });

  return streamsContainers;
}

function renderStream(container, streamData, createMenu = true) {
  const {
    thumbnail_url: thumbnail,
    title,
    viewer_count: viewerCount,
    user_name: userName,
    game_name: gameName,
  } = streamData;

  const thumbnailHD = thumbnail
    .replace("{width}", "1280")
    .replace("{height}", "720");

  const thumbnailMid = thumbnail
    .replace("{width}", "525")
    .replace("{height}", "295");

  const thumbnailSmall = thumbnail
    .replace("{width}", "292")
    .replace("{height}", "164");

  let targetThumb = thumbnailHD;

  const windowWidth = window.innerWidth;

  if (windowWidth <= 640 > 412) {
    targetThumb = thumbnailMid;
  } else if (windowWidth <= 412) {
    targetThumb = thumbnailSmall;
  }

  const streamThumbImgElement = RaiNodeHelper.createImg(
    targetThumb,
    `Vista previa del canal de ${userName}`
  );

  const streamTitleElement = RaiNodeHelper.createTitle("h2", title);

  // Creamos nodo de parrafo que contendrá nombre del usuario que está emitiendo <p>
  const streamUserParagrapElement = RaiNodeHelper.createParagraph(userName, [
    "grey-text",
    "remark-text",
  ]);

  // Creamos nodo de parrafo que contendrá la categoría en la que emite el streamer
  const streamGameParagraphElement = RaiNodeHelper.createParagraph(gameName, [
    "grey-text",
  ]);

  // Creamos nodo de parrafo que contendrá de viewers e icono <p>
  const streamViewersParagraphElement = RaiNodeHelper.createParagraph("", [
    "purple-text",
  ]);

  // Vectores para dibujar icono de ojo <svg>
  const viewersIconSvgElement = RaiNodeHelper.createSVGElement(
    "0 0 15 15",
    "none",
    "15px",
    "15px"
  );

  const viewersIconPathElement = RaiNodeHelper.createSVGPathElement(
    eyeIconSVGPath,
    "currentColor"
  );

  // Insertanos en el nodo del parrafo el icono del ojo
  viewersIconSvgElement.appendChild(viewersIconPathElement);
  streamViewersParagraphElement.appendChild(viewersIconSvgElement);

  // Creamos span con el numero de personas viendo el directo
  const spanElement = document.createElement("span");
  const viewerCountStr = `${viewerCount
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")} usuarios`;
  spanElement.innerText = viewerCountStr;
  streamViewersParagraphElement.appendChild(spanElement);

  container.addEventListener("click", (e) => {
    changeHighlightedVideo(e, userName);
  });

  if (createMenu) {
    const streamMenu = createStreamMenu(container, userName, streamData);

    container.addEventListener("mouseover", (e) => {
      if (getComputedStyle(streamMenu, null).display !== "flow-root") {
        streamMenu.style.display = "block";
      }
    });

    container.addEventListener("mouseleave", (e) => {
      if (getComputedStyle(streamMenu, null).display !== "flow-root") {
        streamMenu.style.display = "none";
      }
    });
  }

  // Si nos encontramos en el primer elemento le añadimos la clase activo
  if (currentHighlightedStream === userName) {
    container.classList.add("active-stream");
  }

  // Añadimos los elementos al contenedor
  container.appendChild(streamThumbImgElement);
  container.appendChild(streamTitleElement);
  container.appendChild(streamUserParagrapElement);
  container.appendChild(streamGameParagraphElement);
  container.appendChild(streamViewersParagraphElement);
}

function hideLoadingAnimation() {
  const loadingRippleContainer = document.querySelector(
    ".loading-waves-container"
  );
  loadingRippleContainer.style.display = "none";
}

function showLoadingAnimation() {
  const loadingRippleContainer = document.querySelector(
    ".loading-waves-container"
  );
  loadingRippleContainer.style.display = "flex";
}

function showHiddenElements() {
  const hideElements = document.getElementsByClassName("hide");

  for (const item of hideElements) {
    // Evitamos mostrar el contenedor de los favoritos así como el enlace a favoritos si el array de estos está vacío
    if (
      (item.id === "favourite-streams-wrapper" ||
        item.id === "favourites-link") &&
      favouriteList.length === 0
    ) {
      continue;
    }

    item.style.visibility = "visible";
    item.style.opacity = "1";
  }

  return hideElements;
}

/**
 *
 * @param {number} width
 * @param {number} height
 * @param {string} channel
 * @param {string} playerDivID
 */
function createTwitchEmbebedVideo(
  width,
  height,
  channel,
  playerDivID,
  autoplayPlayer = false
) {
  const options = {
    width,
    height,
    channel,
    autoplay: autoplayPlayer,
    parent: [
      "twitch-top100.jrai.dev",
      "twitch-top-100-hispano.vercel.app",
      "rai.ddns.net",
      "rai.departamentoinformaticajmpp.com",
      //   "localhost",
      //   "192.168.1.36",
      //   "127.0.0.1",
    ],
  };

  player = new Twitch.Embed(playerDivID, options);
  player.setVolume(0.5);

  const firstStreamElement = streamsHTMLContainers[0];
  firstStreamElement.classList.add("active-stream");
}

function displayErrorMessage(container, errorMessage) {
  const errorWrapperElement = document.createElement("div");
  errorWrapperElement.id = "error-wrapper";
  errorWrapperElement.classList.add("m-2");

  const errorNoticeElement = document.createElement("div");
  errorNoticeElement.classList.add("error-notice");

  const errorColorBrandElement = document.createElement("div");
  errorColorBrandElement.classList.add("error-color-brand");

  const errorMessageElement = document.createElement("div");
  errorMessageElement.classList.add("error-message");

  const titleString = "😢 Lo siento, algo ha salido mal";
  const msgString =
    "Esta aplicación utiliza un servicio de Twitch que ahora mismo no está disponible.";

  const errorTitleElement = RaiNodeHelper.createTitle("h1", titleString, [
    "color-black",
  ]);
  const errorParagraphElement = RaiNodeHelper.createParagraph(msgString, [
    "error-description",
    "m-2",
  ]);
  const reconnectAnchorElement = RaiNodeHelper.createAnchor(
    "Reconectar",
    ".",
    "_self",
    ["button", "m-2"]
  );
  const errorStatusElement = RaiNodeHelper.createParagraph(errorMessage, [
    "error-type",
    "m-2",
  ]);

  errorMessageElement.appendChild(errorTitleElement);
  errorMessageElement.appendChild(errorParagraphElement);
  errorMessageElement.appendChild(reconnectAnchorElement);
  errorMessageElement.appendChild(errorStatusElement);

  errorNoticeElement.appendChild(errorColorBrandElement);
  errorNoticeElement.appendChild(errorMessageElement);

  errorWrapperElement.appendChild(errorNoticeElement);

  container.insertBefore(errorWrapperElement, container.firstChild);
}

function createStreamMenu(container, streamerName, streamData) {
  const streamMenuElement = document.createElement("div");
  streamMenuElement.classList.add("stream-menu");

  const itemListElement = document.createElement("ul");
  streamMenuElement.appendChild(itemListElement);

  const itemGoChannelElement = document.createElement("li");
  const linkGoChannelElement = RaiNodeHelper.createAnchor(
    "Ir al canal",
    `http://www.twitch.tv/${streamerName}`,
    "_blank"
  );
  linkGoChannelElement.classList.add("stream-menu-button");
  itemGoChannelElement.appendChild(linkGoChannelElement);

  const itemAddFavouriteElement = document.createElement("li");

  const linkAddFavouriteElement = document.createElement("a");
  linkAddFavouriteElement.href = "javascript:void(0);";
  linkAddFavouriteElement.innerText = "Añadir a favoritos";
  linkAddFavouriteElement.addEventListener("click", addToFavourite);
  linkAddFavouriteElement.streamData = streamData;
  linkAddFavouriteElement.classList.add("stream-menu-button");

  itemListElement.appendChild(itemGoChannelElement);
  itemListElement.appendChild(itemAddFavouriteElement);

  itemAddFavouriteElement.appendChild(linkAddFavouriteElement);

  streamMenuElement.appendChild(itemListElement);
  container.appendChild(streamMenuElement);

  return streamMenuElement;
}

/**
 *
 * @param {Event} e
 * @param {string} channel
 */
function changeHighlightedVideo(e, channel) {
  // Evitamos que cualquier botón dentro del contenedor pueda hacer cambiar el stream activo.
  if (e.target.className === "stream-menu-button") {
    return;
  }

  if (currentHighlightedStream !== channel) {
    const previousActiveHighlightStream = document.querySelector(
      ".stream-container.active-stream"
    );

    if (previousActiveHighlightStream != null) {
      previousActiveHighlightStream.classList.remove("active-stream");
    }

    e.target.parentNode.classList.add("active-stream");
    currentHighlightedStream = channel;

    const iframeElement = document.querySelector("iframe");
    // iframeElement.src = `https://player.twitch.tv/?channel=${channel}&parent=127.0.0.1`;
    player.setChannel(channel);
    player.play();

    setTimeout(() => {
      iframeElement.scrollIntoView({
        behavior: "smooth",
        block: "end",
        inline: "nearest",
      });
    }, 200);
  }
}

/**
 *
 * @param {Array} viewersArray
 */
function calculateTotalViewers(viewersArray) {
  const totalViewers = viewersArray.reduce(sum);

  return totalViewers;
}

function sum(previousValue, accValue) {
  return (previousValue += accValue);
}

function removeContainers(arrayHTMLContainers) {
  if (arrayHTMLContainers) {
    arrayHTMLContainers.map((container) => {
      container.remove();
      return true;
    });
  }
}

function updateStreamsContainersFilterByUsername(e) {
  const filter = e.target.value.toLowerCase();

  const streamsWrapper = document.querySelector("div.streams");

  let filteredStreams;
  removeContainers(streamsHTMLContainers);

  if (filter !== undefined || filter !== "") {
    // Cuando no se ha escrito ningun filtro de busqueda, se muestran todos los streams

    // Se muestra solo los streams que contengan el filtro de busqueda
    // removeContainers(streamsHTMLContainers);

    if (filter.length < 3) {
      filteredStreams = streamsDataList.filter((element) =>
        element.user_login.startsWith(filter)
      );
    } else {
      filteredStreams = streamsDataList.filter((element) =>
        element.user_login.includes(filter)
      );
    }

    streamsHTMLContainers = renderStreams(filteredStreams, streamsWrapper);
  }
}

/**
 *
 * @param {Event} e
 */
function searchButtonClickHandler(e) {
  const scrolled = window.pageYOffset;
  const coords = document.documentElement.clientHeight;
  const scrollTriggerCondition = scrolled < coords / 4;

  if (scrollTriggerCondition) {
    searchInputField.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  }

  // Ejecutamos el focus en un timeout para que dé tiempo suficiente de realizar el scroll hacia abajo
  window.setTimeout(() => {
    e.target.focus();
  }, 500);
}

function getChannelData(broadcasterIDs) {
  const userIDsEndpointStr = () => {
    let finalParamsURI = "";
    const userParamURI = "&broadcaster_id=";

    broadcasterIDs.forEach((broadcasterID) => {
      finalParamsURI += `${userParamURI}${broadcasterID}`;
    });

    return finalParamsURI;
  };

  const finalURI = userIDsEndpointStr();

  const promiseObject = getAPIData(
    `https://api.twitch.tv/helix/channels?${finalURI}`
  );

  return promiseObject;
}

/**
 *
 * @param {Array} userIDs
 * @returns
 */
function getStreamDataById(userIDs) {
  const userIDsEndpointStr = () => {
    let finalParamsURI = "";
    const userParamURI = "&user_id=";

    userIDs.forEach((userID) => {
      finalParamsURI += `${userParamURI}${userID}`;
    });

    return finalParamsURI;
  };

  const finalURI = userIDsEndpointStr();

  const promiseObject = getAPIData(
    `https://api.twitch.tv/helix/streams?${finalURI}`
  );

  return promiseObject;
}

async function renderFavouriteStreams() {
  if (favouriteList.length > 0) {
    const favOnlineChannelsObjData = await getStreamDataById(favouriteList); // Objeto con array de datos
    const favOnlineData = favOnlineChannelsObjData.data; // Array de datos de streams online que están en la lista de favoritos

    const onlineIdList = [];

    favOnlineData.forEach((onlineStreamData) => {
      onlineIdList.push(onlineStreamData.user_id);
    });

    // Comparar lista entera A con lista entera B
    const remainingOfflineFavs = favouriteList.filter(
      (favItem) => !onlineIdList.includes(favItem)
    );

    // Imprimimos primero favoritos online y sobreescribimos nuestro contenedor de elementos HTML que contienen
    // estos streams
    const favouritesHTMLContainersList = renderStreams(
      favOnlineData,
      document.querySelector("#favourites"),
      false
    );

    // Obtenemos datos de canales offline
    if (remainingOfflineFavs.length > 0) {
      const favOfflineObjData = await getChannelData(remainingOfflineFavs);
      const favOfflineData = favOfflineObjData.data;

      removeContainers(favouritesOfflineHTMLContainers);
      favouritesOfflineHTMLContainers = renderChannelsInfo(
        favOfflineData,
        document.querySelector("#favourites-offline")
      );
    }

    return favouritesHTMLContainersList;
  }
}

function getAllFavourites() {
  let finalFavList;
  let favList = localStorage.getItem("favourites");

  if (favList != null) {
    finalFavList = favList.split(",");

    // Evitamos propagar nulo y propagamos array vacio
  } else {
    favList = [];
    finalFavList = favList;
  }

  return finalFavList;
}

/**
 *
 * @param {Event} e
 */
async function addToFavourite(e) {
  let favouriteListStr = favouriteList.toString();
  const newUserIdStreamFav = e.target.streamData.user_id;

  if (favouriteListStr === "") {
    favouriteListStr = `${newUserIdStreamFav}`;
  } else {
    favouriteListStr += `,${newUserIdStreamFav}`;
  }

  // localStorage.setItem(e.target.streamData.user_name, e.target.streamData.user_id);
  if (!checkIfExistsFavourite(newUserIdStreamFav)) {
    localStorage.setItem("favourites", `${favouriteListStr}`);
    favouriteList.push(newUserIdStreamFav);

    if (favouriteList.length === 1) {
      showHiddenElements();
    }

    // removeFavouritesContainers();
    removeContainers(favouritesHTMLContainers);
    showLoadingAnimation();
    favouritesHTMLContainers = await renderFavouriteStreams();

    hideLoadingAnimation();
    favouritesHTMLContainers[0].scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }
}

function checkIfExistsFavourite(userId) {
  return favouriteList.toString().includes(userId);
}

function trackScroll() {
  const scrolled = window.pageYOffset;
  const coords = document.documentElement.clientHeight;

  if (scrolled > coords) {
    backTopButton.classList.add("show");
  }
  if (scrolled < coords) {
    backTopButton.classList.remove("show");
  }
}

function scrollToTop() {
  const iframe = document.querySelector("iframe");
  iframe.scrollIntoView({
    behavior: "smooth",
    block: "end",
    inline: "nearest",
  });
}
