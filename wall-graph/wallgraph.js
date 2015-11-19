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
nutella = NUTELLA.init("ltg.evl.uic.edu", "wallcology", 
  params.run, "wallcology_admin", 
  function(e) { 
    console.log("Nutella connecting", e) }, {secure: true})

message = {habitat: parseInt(params.habitat), points: 100, 
  from: new Date("24 October, 2015").getTime(), 
  to: Date.now()}

window.data = []
_.chain(_.range(0,15)).each(function(x) {
  msg = _.extend(message, {species: x})
  var pop_array;
  nutella.net.request("population_history", msg, function(e) { 
    window.data.push(e)
  })
})

function transformData(data) {
  return [data.timestamp, data.population]
}

function transformSeries(series) {
  return {data: _.map(series, transformData)}
}
window.olddata = {}
function graph() {
  console.log("updating graph")
  var graphobj = {
        chart: {
            type: 'line'
        },
        title: {
            text: 'Historical population graph'
        },
        xAxis: {
          type: 'datetime'
            // categories: ['Apples', 'Bananas', 'Oranges']
        },
        yAxis: {
            // title: {
            //     text: 'Fruit eaten'
            // }
        },
        series: _.map(window.data, transformSeries)
    }
    window.graphobj = graphobj
    if(!_.isEqual(window.olddata, window.data)) { 
      $('#container').highcharts(graphobj);
      window.olddata = _.clone(window.data);
    }
    setTimeout(function(){ graph()}, 30000);
}

setTimeout(function(){ graph()}, 4000);
