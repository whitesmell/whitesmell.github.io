'use strict';

const photos = [
  ['02','从玄关望向庭院','entry',1062],
  ['03','康熙金漆屏风与意大利 Art Deco 长凳','entry',1125],
  ['04','展望的不锈钢假山石','entry',1200,475],
  ['18','泳池与庭院','entry',1000],
  ['05','主客厅与张恩利《THE VENT 通风口》','living',1236],
  ['06','陆平原《LOOK! I’m Picasso -1810-3》','living',1121],
  ['01','法国古董镜与壁炉','living',1125],
  ['08','徐震《天下-3302MQ0137》','living',1000],
  ['09','餐厅通往玄关的走廊','living',1014],
  ['10','餐厅望向阳光房','living',1500,1000],
  ['11','圆桌餐厅与墙面画作','living',1500,1000],
  ['12','主卧套房的小书房与起居区','private',1125],
  ['13','一楼小客厅书房 · 尼奥·劳赫画作','private',1090],
  ['14','一楼小客厅书房','private',1000],
  ['15','主卧 · 帷幔床','private',1125],
  ['16','卧室中的画作','private',1119],
  ['17','浴室与窗外绿意','private',1118],
];
const plans = [
  ['20','一层平面图','plan',3600,2545],
  ['21','二层平面图','plan',3600,2545],
  ['19','地下一层平面图','plan',3600,2545],
];
const spots = [
  { id:'entry', floor:'20', n:'01', name:'玄关与庭院', x:50.8, y:49.5, photos:['02','03','04','18'],
    description:'从玄关的不锈钢假山石望出去，整面玻璃把室内的视线接到泳池和庭院。' },
  { id:'living', floor:'20', n:'02', name:'主客厅', x:28.6, y:49.5, photos:['05','06','01','08'],
    description:'挑高客厅里，徐震的《天下》被装框平放，藏品成了沙发之间可以围坐的家具。' },
  { id:'study', floor:'20', n:'03', name:'小客厅书房', x:36.2, y:22.8, photos:['14','13'],
    description:'从客厅可进入这间下沉式书房。红沙发与羽毛灯是一侧，尼奥·劳赫的画和橘色椅子在另一侧。' },
  { id:'dining', floor:'20', n:'04', name:'餐厅与阳光房', x:71.2, y:53.2, photos:['10','11','09'],
    description:'用餐区位于主客厅的另一翼。圆桌、白色餐椅与相邻走廊的蓝色画作，把三个拍摄视角连在一起。' },
  { id:'upper-hall', floor:'21', n:'01', name:'楼梯与走廊', x:43.6, y:47.3, photos:[],
    description:'从图纸可见，楼梯抵达二层后接入走廊，沿走廊可前往两翼的房间。' },
  { id:'upper-suite', floor:'21', n:'02', name:'主卧套房', x:63.7, y:47, photos:['12','15'],
    description:'屋主访谈将小书房与起居区归入二层主卧套房；帷幔床和床头小幅油画可对应主卧。点位代表套房区域。' },
  { id:'upper-bath', floor:'21', n:'03', name:'窗边浴室', x:84.8, y:53.5, photos:['17'], inferred:true,
    description:'照片里独立浴缸靠外窗，与二层右侧浴室的图纸布置相近。公开资料未标明具体房间，点位仅供对照。' },
  { id:'lower-seat', floor:'19', n:'01', name:'左侧围坐区', x:29.7, y:24.4, photos:[],
    description:'图纸左上方可见弧形沙发和几张座椅，围合成一处相对独立的休息区。' },
  { id:'lower-hall', floor:'19', n:'02', name:'楼梯与过道', x:39.7, y:40.2, photos:[],
    description:'楼梯在图纸中部偏左；前方的过道连接两翼空间。' },
];

const byId = id => document.getElementById(id);
const imagePath = (id, small=false) => 'assets/'+id+(small?'-small':'')+'.webp';
const photoMap = new Map([...photos,...plans].map(item => [item[0],item]));
const floorName = id => photoMap.get(id)[1].replace('平面图','');
const spotByPhoto = new Map(spots.flatMap(spot => spot.photos.map(id => [id,spot])));
const photosAt = spot => spot.photos.map(id => photoMap.get(id));
const gallery = byId('photo-grid');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const galleryLocation = byId('gallery-location');
let visiblePhotos = photos;
let gallerySpot = null;

function jumpTo(section, focusTarget) {
  byId(section).scrollIntoView({block:'start'});
  focusTarget?.focus({preventScroll:true});
}

function renderGallery(filter='all', spot=null) {
  gallerySpot = spot;
  visiblePhotos = spot ? photosAt(spot) : photos.filter(photo => filter==='all'||photo[2]===filter);
  const figures = visiblePhotos.map(([id, caption, ,width,height=1500]) => {
    const figure = document.createElement('figure');
    const button = document.createElement('button');
    const img = document.createElement('img');
    const icon = document.createElement('span');
    const label = document.createElement('figcaption');
    const num = document.createElement('b');
    button.type = 'button';
    button.className = 'image-button';
    button.dataset.photo = id;
    button.setAttribute('aria-label','放大：'+caption);
    img.src = imagePath(id,width<height);
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = caption;
    img.width = width;
    img.height = height;
    icon.className = 'expand';
    icon.setAttribute('aria-hidden','true');
    icon.textContent = '↗';
    num.textContent = String(photos.indexOf(photoMap.get(id))+1).padStart(2,'0');
    button.append(img,icon);
    label.append(num,caption);
    figure.append(button,label);
    const location = spotByPhoto.get(id);
    if (location) {
      const locate = document.createElement('button');
      locate.type = 'button';
      locate.className = 'gallery-locate';
      const action = location.inferred ? '看推定区域' : '在平面图中查看';
      locate.textContent = floorName(location.floor)+' '+location.n+' · '+action+' ↗';
      locate.setAttribute('aria-label',action+'：'+floorName(location.floor)+'，'+location.name+'，'+caption);
      locate.addEventListener('click',() => locatePhoto(id));
      figure.append(locate);
    }
    return figure;
  });
  gallery.replaceChildren(...figures);
  byId('gallery-count').textContent = visiblePhotos.length+' 张照片';
  filterButtons.forEach(button => button.setAttribute('aria-pressed',String(!spot && button.dataset.filter===filter)));
  galleryLocation.hidden = !spot;
  byId('gallery-location-label').textContent = spot ? floorName(spot.floor)+' / '+spot.name+(spot.inferred?'（推定）':'') : '';
}
filterButtons.forEach(button => button.addEventListener('click',() => renderGallery(button.dataset.filter)));
byId('gallery-clear').addEventListener('click',() => {
  renderGallery();
  filterButtons[0].focus();
});
byId('gallery-back').addEventListener('click',() => {
  if (gallerySpot) goToSpot(gallerySpot);
});

const floorButtons = [...document.querySelectorAll('[data-floor]')];
const markers = byId('plan-markers');
const spotList = byId('spot-list');
const viewport = byId('plan-viewport');
const canvas = byId('plan-canvas');
const spotPhoto = byId('spot-photo');
const mobileRoutePhoto = byId('route-mobile-photo');
const route = byId('route');
const routeToggle = byId('route-toggle');
const routeButtons = [...route.querySelectorAll('[data-route-stop]')];
const routeSpots = routeButtons.map(button => spots.find(spot => spot.id===button.dataset.routeStop));
const routePrev = byId('route-prev');
const routeNext = byId('route-next');
let routeActive = false;
const scales = [1,1.5,2,3];
let scaleIndex = 0;
let activeFloor;
let activeSpot;
let drag;

function centerMarker(spot) {
  viewport.scrollLeft = canvas.clientWidth*spot.x/100-viewport.clientWidth/2;
  viewport.scrollTop = canvas.clientHeight*spot.y/100-viewport.clientHeight/2;
}

function zoomPlan(index) {
  scaleIndex = Math.max(0,Math.min(index,scales.length-1));
  const percent = scales[scaleIndex]*100;
  canvas.style.width = percent+'%';
  viewport.classList.toggle('is-pannable',scaleIndex>0);
  byId('plan-reset').textContent = percent+'%';
  byId('plan-minus').disabled = scaleIndex===0;
  byId('plan-plus').disabled = scaleIndex===scales.length-1;
  byId('plan-gesture').textContent = scaleIndex>0 ? '拖动查看其他区域' : '放大后可拖动查看';
  if (scaleIndex>0 && activeSpot) centerMarker(activeSpot);
  else viewport.scrollTo(0,0);
}
byId('plan-minus').addEventListener('click',() => zoomPlan(scaleIndex-1));
byId('plan-plus').addEventListener('click',() => zoomPlan(scaleIndex+1));
byId('plan-reset').addEventListener('click',() => zoomPlan(0));
viewport.addEventListener('pointerdown',event => {
  if (!scaleIndex || event.pointerType!=='mouse' || event.button!==0 || event.target.closest('button')) return;
  viewport.setPointerCapture(event.pointerId);
  drag = [event.clientX,event.clientY,viewport.scrollLeft,viewport.scrollTop];
  viewport.classList.add('is-dragging');
});
viewport.addEventListener('pointermove',event => {
  if (!drag) return;
  viewport.scrollLeft = drag[2]+drag[0]-event.clientX;
  viewport.scrollTop = drag[3]+drag[1]-event.clientY;
});
viewport.addEventListener('lostpointercapture',() => {
  drag = null;
  viewport.classList.remove('is-dragging');
});

function makeSpotButton(spot,onMap) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.spot = spot.id;
  button.setAttribute('aria-pressed','false');
  if (onMap) {
    button.className = spot.inferred ? 'plan-marker is-inferred' : 'plan-marker';
    button.style.left = spot.x+'%';
    button.style.top = spot.y+'%';
    button.setAttribute('aria-label',spot.n+' '+spot.name+(spot.inferred?'，推定区域':''));
    button.textContent = spot.n;
  } else {
    const number = document.createElement('b');
    number.textContent = spot.n;
    button.append(number,spot.name+(spot.inferred?' · 推定':''));
  }
  button.addEventListener('click',() => selectSpot(spot));
  return button;
}

function renderRoute() {
  const index = routeActive ? routeSpots.indexOf(activeSpot) : -1;
  const active = index>=0;
  route.classList.toggle('is-active',active);
  byId('floor-panel').classList.toggle('is-touring',active);
  routeToggle.setAttribute('aria-expanded',String(active));
  routeToggle.textContent = active ? '退出导览' : '开始导览 ↓';
  byId('route-controls').hidden = !active;
  mobileRoutePhoto.hidden = !active;
  routeButtons.forEach((button,i) => {
    if (i===index) button.setAttribute('aria-current','step');
    else button.removeAttribute('aria-current');
  });
  if (!active) return;
  const stopName = routeButtons[index].querySelector('span').textContent;
  byId('route-status').textContent = '第 '+(index+1)+' / '+routeSpots.length+' 站 · '+stopName;
  routePrev.disabled = index===0;
  routeNext.textContent = index===routeSpots.length-1 ? '从头再看 ↺' : '下一站 →';
  const id = spotPhoto.dataset.photo;
  byId('route-mobile-image').src = imagePath(id,true);
  byId('route-mobile-title').textContent = stopName;
  byId('route-mobile-count').textContent = activeSpot.photos.length+' 张现场照片';
  mobileRoutePhoto.dataset.photo = id;
  mobileRoutePhoto.setAttribute('aria-label','看大图：'+photoMap.get(id)[1]);
}

function visitRoute(index) {
  const spot = routeSpots[index];
  routeActive = true;
  if (activeFloor===spot.floor) selectSpot(spot);
  else selectFloor(spot.floor,spot);
}

function selectSpot(spot,photoId) {
  if (routeActive && !routeSpots.includes(spot)) routeActive = false;
  activeSpot = spot;
  for (const button of byId('floor-panel').querySelectorAll('[data-spot]')) {
    button.setAttribute('aria-pressed',String(button.dataset.spot===spot.id));
  }
  byId('spot-kicker').textContent = floorName(spot.floor)+' / 点位 '+spot.n+(spot.inferred?' · 推定区域':'');
  byId('spot-title').textContent = spot.name;
  byId('plan-selection').textContent = spot.n+' · '+spot.name;
  byId('spot-description').textContent = spot.description;
  const selected = spot.photos.includes(photoId) ? photoId : spot.photos[0];
  spotPhoto.hidden = byId('spot-gallery').hidden = !selected;
  byId('spot-no-photo').hidden = Boolean(selected);
  if (selected) {
    const caption = photoMap.get(selected)[1];
    spotPhoto.dataset.photo = selected;
    spotPhoto.setAttribute('aria-label','放大：'+caption);
    byId('spot-image').src = imagePath(selected,true);
    byId('spot-image').alt = caption;
    byId('spot-gallery').textContent = '查看此处图集（'+spot.photos.length+' 张） ↗';
  }
  if (scaleIndex>0) centerMarker(spot);
  renderRoute();
}

function selectFloor(id, spot, photoId) {
  const routeSpot = routeActive && id===activeFloor ? activeSpot : null;
  if (id!=='20') routeActive = false;
  activeFloor = id;
  const label = photoMap.get(id)[1];
  for (const tab of floorButtons) {
    const selected = tab.dataset.floor===id;
    tab.setAttribute('aria-selected',String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  byId('floor-panel').setAttribute('aria-labelledby','tab-'+id);
  byId('floor-caption').textContent = label;
  byId('floor-image').src = imagePath(id);
  byId('floor-image').alt = '蝶居'+label;
  byId('open-plan').dataset.photo = id;
  byId('open-plan').setAttribute('aria-label','查看'+label+'原图');
  const floorSpots = spots.filter(item => item.floor===id);
  markers.replaceChildren(...floorSpots.map(item => makeSpotButton(item,true)));
  spotList.replaceChildren(...floorSpots.map(item => makeSpotButton(item,false)));
  byId('spot-total').textContent = floorSpots.length+' 个点位';
  zoomPlan(0);
  selectSpot(spot || routeSpot || floorSpots[0],photoId);
}

function goToSpot(spot,photoId) {
  if (activeFloor===spot.floor) selectSpot(spot,photoId);
  else selectFloor(spot.floor,spot,photoId);
  jumpTo('plan-explorer',byId('spot-title'));
}

function locatePhoto(id) {
  const spot = spotByPhoto.get(id);
  if (spot) goToSpot(spot,id);
}
routeToggle.addEventListener('click',() => {
  if (routeActive) {
    routeActive = false;
    renderRoute();
  } else visitRoute(0);
});
routeButtons.forEach((button,index) => button.addEventListener('click',() => visitRoute(index)));
routePrev.addEventListener('click',() => {
  const previous = routeSpots.indexOf(activeSpot)-1;
  if (previous<0) return;
  visitRoute(previous);
  if (previous===0) routeNext.focus({preventScroll:true});
});
routeNext.addEventListener('click',() => {
  visitRoute((routeSpots.indexOf(activeSpot)+1)%routeSpots.length);
});
byId('plan-details').addEventListener('click',() => jumpTo('spot-detail',byId('spot-title')));
byId('spot-gallery').addEventListener('click',() => {
  renderGallery('all',activeSpot);
  jumpTo('gallery',byId('gallery-back'));
});
floorButtons.forEach((button,index) => {
  button.addEventListener('click',() => selectFloor(button.dataset.floor));
  button.addEventListener('keydown',event => {
    const target = ({ArrowRight:(index+1)%3,ArrowLeft:(index+2)%3,Home:0,End:2})[event.key];
    if (target===undefined) return;
    event.preventDefault();
    floorButtons[target].focus();
    selectFloor(floorButtons[target].dataset.floor);
  });
});
renderGallery();
selectFloor('20');

const lightbox = byId('lightbox');
const stage = byId('light-stage');
const zoom = byId('light-zoom');
const lightStrip = byId('light-strip');
const lightLocate = byId('light-locate');
let sequence = [];
let current = 0;
let trigger;
let afterClose;
let swipe;

function setZoom(active) {
  stage.classList.toggle('is-zoomed',active);
  zoom.setAttribute('aria-pressed',String(active));
  zoom.textContent = active ? '适应窗口' : '放大';
  stage.scrollTop = 0;
  stage.scrollLeft = active ? (stage.scrollWidth-stage.clientWidth)/2 : 0;
}
function buildStrip() {
  lightStrip.hidden = sequence.length<2 || sequence[0][2]==='plan';
  if (lightStrip.hidden) {
    lightStrip.replaceChildren();
    return;
  }
  lightStrip.replaceChildren(...sequence.map(([id,caption],index) => {
    const button = document.createElement('button');
    const image = document.createElement('img');
    button.type = 'button';
    button.setAttribute('aria-label',(index+1)+'：'+caption);
    image.src = imagePath(id,true);
    image.alt = '';
    image.draggable = false;
    button.append(image);
    button.addEventListener('click',() => {
      current = index;
      showImage();
    });
    return button;
  }));
  lightStrip.scrollLeft = 0;
}
function showImage() {
  const [id, caption] = sequence[current];
  byId('light-image').src = imagePath(id);
  byId('light-image').alt = caption;
  byId('light-title').textContent = caption;
  byId('light-count').textContent = (current+1)+' / '+sequence.length;
  byId('light-prev').hidden = byId('light-next').hidden = sequence.length<2;
  const location = spotByPhoto.get(id);
  lightLocate.hidden = !location;
  lightLocate.textContent = location?.inferred ? '看推定区域 ↗' : '看平面图 ↗';
  [...lightStrip.children].forEach((button,index) => {
    if (index===current) button.setAttribute('aria-current','true');
    else button.removeAttribute('aria-current');
  });
  const thumb = lightStrip.children[current];
  if (thumb) {
    const start = thumb.offsetLeft;
    if (start<lightStrip.scrollLeft) lightStrip.scrollLeft = start;
    if (start+thumb.offsetWidth>lightStrip.scrollLeft+lightStrip.clientWidth) lightStrip.scrollLeft = start+thumb.offsetWidth-lightStrip.clientWidth;
  }
  setZoom(false);
}
function step(delta) {
  current = (current+delta+sequence.length)%sequence.length;
  showImage();
}
document.addEventListener('click',event => {
  const button = event.target.closest('[data-photo]');
  if (!button) return;
  const photo = photoMap.get(button.dataset.photo);
  if (!photo) return;
  trigger = button;
  afterClose = null;
  sequence = photo[2]==='plan' ? plans : (button===spotPhoto||button===mobileRoutePhoto) ? photosAt(activeSpot) : gallery.contains(button) ? visiblePhotos : photos;
  current = sequence.indexOf(photo);
  buildStrip();
  lightbox.showModal();
  showImage();
});
byId('light-close').addEventListener('click',() => lightbox.close());
byId('light-prev').addEventListener('click',() => step(-1));
byId('light-next').addEventListener('click',() => step(1));
zoom.addEventListener('click',() => setZoom(zoom.getAttribute('aria-pressed')!=='true'));
lightLocate.addEventListener('click',() => {
  const id = sequence[current][0];
  afterClose = () => locatePhoto(id);
  lightbox.close();
});
lightbox.addEventListener('close',() => {
  if (afterClose) {
    const navigate = afterClose;
    afterClose = null;
    navigate();
  } else if (trigger?.isConnected) trigger.focus({preventScroll:true});
});
lightbox.addEventListener('click',event => { if (event.target===lightbox) lightbox.close(); });
lightbox.addEventListener('keydown',event => {
  if (sequence.length<2 || stage.classList.contains('is-zoomed')) return;
  if (event.key==='ArrowLeft'||event.key==='ArrowRight') {
    event.preventDefault();
    step(event.key==='ArrowLeft' ? -1 : 1);
  }
});
stage.addEventListener('touchstart',event => {
  if (event.touches.length!==1 || stage.classList.contains('is-zoomed')) {
    swipe = null;
    return;
  }
  const {clientX,clientY} = event.touches[0];
  swipe = [clientX,clientY];
},{passive:true});
stage.addEventListener('touchend',event => {
  if (!swipe) return;
  const {clientX,clientY} = event.changedTouches[0];
  const dx = clientX-swipe[0];
  const dy = clientY-swipe[1];
  if (sequence.length>1 && Math.abs(dx)>48 && Math.abs(dx)>Math.abs(dy)*1.5) step(dx<0 ? 1 : -1);
  swipe = null;
},{passive:true});
stage.addEventListener('touchcancel',() => { swipe = null; });
