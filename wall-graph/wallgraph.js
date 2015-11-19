// from http://stackoverflow.com/posts/8486146/revisions
function getUrlParams() {
  var regex = /[?&]([^=#]+)=([^&#]*)/g,
    url = window.location.href,
    params = {},
    match;
  while(match = regex.exec(url)) {
    params[match[1]] = match[2];
  }
  return params;
}

params = getUrlParams()
console.log(params)
nutella = NUTELLA.init("ltg.evl.uic.edu", "wallcology", params.run, "wallcology_admin", 
                       function(e) { console.log(e) }, {secure: true})
console.log("Nutella connected", nutella)
message = {habitat: 0 + params.habitat, points: 100, from: new Date("24 October, 2015"), 
  to: Date.now()}
_.chain(_.range(0,15)).each(function(x) {
  msg = _.extend(message, {species: x})
  nutella.net.request("population_history", msg, function(e) { 
    var pop_array = _.chain(e).map(function(x) { 
      return(x.population) }).value()
    console.log(pop_array)
  })
})

