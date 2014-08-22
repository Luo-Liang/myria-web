// put all the underscore templates here
var max_dataset_size = 10*1000*1000;
var editor_templates = {
  //*/
  urls: {
    profiling: _.template("http://<%- myria %>/logs/profiling?queryId=<%- query_id %>")
  },
  query: {
    table: _.template('<table class="table table-condensed table-striped"><thead><tr><th colspan="2">Query <a href="http://<%- connection %>" target="_blank">#<%- query_id %></a></th></tr></thead><trbody><%= content %></trbody></table>'),
    row: _.template('<tr><td><%- name %></td><td><%- val %></td></tr>'),
    time_row: _.template('<tr><td><%- name %></td><td><abbr class="timeago" title="<%- val %>"><%- val %></abbr></td></tr>'),
    prof_link: _.template('<p>Profiling results: <a href="/profile?queryId=<%- query_id %>" class="glyphicon glyphicon-dashboard" title="Visualization of query profiling" data-toggle="tooltip"></a>'),
    err_msg: _.template('<p>Error message:</p><pre><%- message %></pre>'),
    dataset_table: _.template('<table class="table table-condensed table-striped"><thead><tr><th colspan="2">Datasets Created</th></tr></thead><trbody><%= content %></trbody></table>'),
    dataset_row: _.template('<tr><td><%- userName %>:<%- programName %>:<%- relationName %></td><td><%- numTuples %> tuples <% if (numTuples < max_dataset_size) { %> <a href="<%- uri %>format=json" rel="nofollow" class="label label-default">JSON</a> <a href="<%- uri %>format=csv" rel="nofollow" class="label label-default">CSV</a> <a href="<%- uri %>format=tsv" rel="nofollow" class="label label-default">TSV</a><% } %></td></tr>')
  },
  dataset: {
    table: _.template('<table class="table table-condensed table-striped"><thead><tr><th>Name</th><th>Type</th></tr></thead><trbody><%= content %></trbody></table>'),
    row: _.template('<tr><td><%- name %></td><td><%- type %></td></tr>'),
    dslink: _.template('<p>More details: <a href="<%- url %>"><%- user %>:<%- program %>:<%- name %></a></p>')
  },
  trim_example: _.template('\n... <%- remaining %> more line<% print(remaining > 1 ? "s": ""); %>')
};

var editorLanguage = 'myrial',
  editorStateKey = 'code-editor-state',
  editorLanguageKey = 'active-language',
  editorBackendKey = 'myria',
  developerCollapseKey = 'developer-collapse',
  backendProcess = 'myria',
  grappaends = ['grappa', 'clang'],
  editorState = {};

function handleerrors(request, display) {
  request.done(function (result) {
    var formatted = result.split("\n").join("<br>");
    $(display).html(formatted);
  });

  request.fail(function (jqXHR, textStatus, errorThrown) {
    if (textStatus == 'timeout') {
      $(display).text("Server is not responding");
      return;
    }

    $(display).text(jqXHR.responseText);
  });
}

function getplan() {
  var query = editor.getValue();
  var request = $.post("plan", {
    query: query,
    language: editorLanguage,
    backend: backendProcess,
    multiway_join: $("#multiway-join").is(':checked')
  });
  handleerrors(request, "#plan");
  request = $.post("dot", {
    query: query,
    type: 'logical',
    backend: backendProcess,
    language: editorLanguage
  });
  request.success(function (dot) {
    var result = Viz(dot, "svg");
    $('#relational_svg').html(result);
    $('svg').width('100%');
    $('svg').height('100%');
  });
}

function optimizeplan() {
  $('#svg').empty();
  getplan(); // make sure the plan matches the query
  var query = editor.getValue();
  var multiway_join_checked = $("#multiway-join").is(':checked');

  var request = $.post("optimize", {
    query: query,
    language: editorLanguage,
    backend: backendProcess,
    multiway_join: multiway_join_checked
  });
  handleerrors(request, "#optimized");


  var request = $.post("compile", {
    query: query,
    language: editorLanguage,
    backend: backendProcess,
    multiway_join: multiway_join_checked
  });

  request.success(function (queryPlan) {
    if (_.contains(grappaends, backendProcess)) {
      function clangrerender() {
        $('#svg').empty();
        var dot = queryPlan.dot;
        var result = Viz(dot, "svg");
        $('#svg').html(result);
        $('svg').width('100%');
	$('svg').height('95%');
      }

      clangrerender();

      // rerender when opening tab because of different space available
      $('a[href="#queryplan"]').on('shown.bs.tab', clangrerender);
      $('#relational-plan').collapse('hide');
      $('#physical-plan').collapse('show');
      clangrerender();
    } else if (backendProcess === "myria") {
      try {
        var i = 0;
        _.map(queryPlan.plan.fragments, function (frag) {

          frag.fragmentIndex = i++;
          return frag;
        });

        var g = new Graph();
        g.loadQueryPlan(queryPlan);

        function myriarerender() {
          $('#svg').empty();
          g.render(d3.select('#svg'));
        }
        myriarerender();

        // rerender when opening tab because of different space available
        $('a[href="#queryplan"]').on('shown.bs.tab', myriarerender);
        $('#relational-plan').collapse('hide');
        $('#physical-plan').collapse('show');
        myriarerender();
      } catch (err) {
        $('#svg').empty();
        $('#optimized').empty();
        $('#relational-plan').collapse('show');
        $('#physical-plan').collapse('hide');
        throw err;
      }
    } else {
	// should not get here
	console.log("unsupported backend");
    }
  }).fail(function (jqXHR, textStatus, errorThrown) {
    $("#optimized").text(jqXHR.responseText);
    $('#svg').empty();
    $('a[href="#queryplan"]').off('shown.bs.tab');
  });
}

function compileplan() {
  var query = editor.getValue();
  var url = "compile?" + $.param({
    query: query,
    language: editorLanguage,
    backend: backendProcess,
    multiway_join: $("#multiway-join").is(':checked')
  });
  window.open(url, '_blank');
}

/* Based on: http://stackoverflow.com/a/6455874/1715495 */
function multiline(elt, text) {
  var htmls = [];
  var lines = text.split(/\n/);
  // The temporary <div/> is to perform HTML entity encoding reliably.
  //
  // document.createElement() is *much* faster than jQuery('<div/>')
  // http://stackoverflow.com/questions/268490/
  //
  // You don't need jQuery but then you need to struggle with browser
  // differences in innerText/textContent yourself
  var tmpDiv = jQuery(document.createElement('div'));
  for (var i = 0; i < lines.length; i++) {
    htmls.push(tmpDiv.text(lines[i]).html());
  }
  elt.html(htmls.join("<br>"));
}

function displayQueryStatus(query_status) {
  var t = editor_templates.query;
  var query_id = query_status['queryId'];
  var status = query_status['status'];
  var html = '';
  var connection = myriaConnection + '/query/query-' + query_id;
  if (_.contains(grappaends, backendProcess)) {
      connection = clangConnection + '/query?qid=' + query_id;
  }
  html += t.row({name: 'Status', val: status});
  html += t.time_row({name: 'Start', val: query_status['startTime']});
  html += t.time_row({name: 'End', val: query_status['finishTime']});
  html += t.row({name: 'Elapsed', val: customFullTimeFormat(query_status['elapsedNanos'], false)});
  html = t.table({connection: connection, query_id: query_id, content: html});

  if (status === 'SUCCESS') {
    connection = 'http://' + myriaConnection + '/dataset';
    var data = {queryId: query_id};
    if (_.contains(grappaends, backendProcess)) {
      connection = 'http://' + clangConnection + '/query';
      data = {qid: query_id};
    }
    // Populate the datasets created table
    $.ajax({
      dataType: "json",
      url: connection,
      data: data,
      async: false})
    .done(function (datasets) {
      if (datasets.length > 0) {
          var d_html = "";
          _.each(datasets, function (d) {
            var relKey = d['relationKey'];
            var dload = d.uri + '/data?';
	    if (_.contains(grappaends, backendProcess)) {
      	      dload += 'qid=' + d['queryId'] + '&';
            }
            d_html += t.dataset_row({uri : dload, userName: relKey.userName,
                programName: relKey.programName,
                relationName: relKey.relationName, numTuples: d.numTuples});
            html += t.dataset_table({content: d_html});
          });
        }
    });
  }

  if (status === 'SUCCESS' && query_status['profilingMode']) {
      html += t.prof_link({query_id: query_id});
  } else if (status === 'ERROR') {
    html += t.err_msg({message: query_status['message'] || '(missing)'});
  }
  $("#query-information").html(html);
  $("abbr.timeago").timeago();

  if (status === 'ACCEPTED' || status === 'RUNNING' || status === 'PAUSED' || status === 'KILLING') {
    setTimeout(function () {
      checkQueryStatus(query_id);
    }, 1000);
  }
}

function displayQueryError(error, query_id) {
  var pre = document.createElement('pre');
  multiline($('#query-information').empty().append(pre),
      "Error checking query status; it's probably done. Attempting to refresh\n" + error.responseText);
  setTimeout(function () {
    checkQueryStatus(query_id);
  }, 1000);
}

function checkQueryStatus(query_id) {
  var errFunc = function (error) {
    displayQueryError(error, query_id);
  };
  $.ajax("execute", {
    type: 'GET',
    data: {
      queryId: query_id,
      language: editorLanguage,
      backend: backendProcess
    },
    success: displayQueryStatus,
    error: errFunc
  });
}

function executeplan() {
  $('#editor-tabs a[href="#result"]').tab('show');

  $('#query-information').text('...');
  optimizeplan(); // make sure the plan matches the query
  var query = editor.getValue();
  var request = $.ajax("execute", {
    type: 'POST',
    data: {
      query: query,
      language: editorLanguage,
      backend: backendProcess,
      profile: $("#profile-enabled").is(':checked'),
      multiway_join: $("#multiway-join").is(':checked')
    },
    statusCode: {
      200: displayQueryStatus,
      201: displayQueryStatus,
      202: displayQueryStatus
    }
  });
  request.error(function (jqXHR, textStatus, errorThrown) {
    var pre = document.createElement('pre');
    $('#query-information').empty().append(pre);
    multiline($(pre), jqXHR.responseText);
  });

}

function resetResults() {
  $(".display").empty();
  $("#query-information").text("Run query to see results here...");
  $("svg").empty();
  $('a[href="#queryplan"]').off('shown.bs.tab');
}

function updateExamples(restored) {
  var language = editorLanguage;
  var doUpdateExamples = function (data) {
    var examplesList = $('#examples-list');

    examplesList.empty();
    if (data.length === 0) {
      examplesList.append('No ' + language + ' examples found');
    } else {
      /* Populate the list of examples. */
      for (var i = 0; i < data.length; ++i) {
        var str = data[i][1],
          delimiter = '\n',
          allTokens = str.split(delimiter),
          tokens = allTokens.slice(0, 2),
          result = tokens.join(delimiter);
        var numLines = str.split(/\r\n|\r|\n/).length;
        var heading = $('<h5>').text(data[i][0]),
          program = $('<pre>').text(result + (numLines > 2 ? editor_templates.trim_example({remaining: allTokens.length - 2}) : ''));
        $('<a href="#" class="list-group-item example"></a>')
          .append(heading)
          .append(program)
          .attr('data-code', data[i][1])
          .appendTo(examplesList);
        updateExamplesHeight();
      }
      /* Restore the click functionality on the examples. */
      $(".example").click(function (e) {
        e.preventDefault();
        resetResults();
        var example_query = this.getAttribute('data-code');
        editor.setValue(example_query);
        optimizeplan();
      });
    }
    $('#editor-tabs a[href="#examples"]').tab('show');
    if (!restored) {
      $(".example").first().click();
    }
  };

  $.ajax("examples", {
    type: 'GET',
    data: {
      language: language,
      subset: $('#examples-list').attr('subset')
    },
    success: doUpdateExamples
  });
}

function resetEditor(newLanguage, saveOld) {
  saveOld = saveOld || false;
  var languages = [ 'datalog', 'myrial', 'sql' ];
  if (!newLanguage || !_.contains(languages, newLanguage)) {
    console.log("Unable to reset editor to new language " + newLanguage);
    return;
  }

  if (saveOld) {
    editorState[editorLanguage] = {
      content: editor.getValue(),
      history: editor.getHistory()
    };
  }

  var restored;
  var state = editorState[newLanguage];
  if (editorState[newLanguage]) {
    editor.setValue(state.content);
    editor.setHistory(state.history);
    restored = true;
  } else {
    restored = false;
    editor.setValue('loading examples...');
    editor.clearHistory();
  }

  editorLanguage = newLanguage;
  var modes = {
    'datalog': 'prolog',
    'myrial': {name: 'myrial', singleLineStringErrors: false},
    'sql': 'text/x-sql'
  };
  editor.setOption('mode', modes[newLanguage]);

  updateExamples(restored);
}

function changeBackend() {
  var backend = $(".backend-menu option:selected").val();
  setBackend(backend);
}

function setBackend(backend) {
  var backends = [ 'myria', 'grappa', 'clang'];
    if (!_.contains(backends, backend)) {
	console.log('Backend not supported: ' + backend);
	return;
    }

  backendProcess = backend;
}
/**
 * This function populates the modal dialog box with the contents of the clicked
 * SVG.
 */
function showSvgModal() {
  $('#svg-modal-output').empty();
  var svgOutput = document.getElementById(this.getAttribute('data-output'));
  var svgModalOutput = document.getElementById("svg-modal-output");
  for (var i = 0; i < svgOutput.childElementCount; ++i) {
    svgModalOutput.appendChild(svgOutput.children[i].cloneNode(true));
  }

  var panzoom = $('.zoom-canvas').panzoom({
    maxScale: 10,
    minScale: 1,
    contain: 'invert',
    $zoomRange: $(".modal-header .zoom-range"),
    $reset: $(".modal-header .zoom-reset")
  }).panzoom("reset");
}

function resizeEditor() {
  if ($('.editor-row').hasClass("expanded")) {
    $('.editor-row').removeClass("expanded");
    $('.editor-row>div:first').attr("class", "col-md-7");
    $('.editor-row>div:nth-child(2)').attr("class", "col-md-5");
    $('.resize-editor>span').removeClass('glyphicon-resize-small').addClass('glyphicon-resize-full');
  } else {
    $('.editor-row').addClass("expanded");
    $('.editor-row>div:first').attr("class", "col-md-12");
    $('.editor-row>div:nth-child(2)').attr("class", "col-md-12");
    $('.resize-editor>span').removeClass('glyphicon-resize-full').addClass('glyphicon-resize-small');
  }
}

function initializeDatasetSearch() {
  var dataToRelKeyString = function (d) {
    return d.userName + ':' + d.programName + ':' + d.relationName;
  };

  $(".dataset-search").select2({
    placeholder: "Search for a dataset...",
    minimumInputLength: 3,
    ajax: {
      url: myriaConnection + "/dataset/search/",
      dataType: 'json',
      quietMillis: 100,
      cache: true,
      data: function (term) {
        return {
          q: term
        };
      },
      results: function (data) {
        return {
          results: data,
          more: false
        };
      }
    },
    formatResult: function (d, container, query) {
      var stringParts = dataToRelKeyString(d).split('');
      var queryParts = query.term.toLowerCase().split('');
      var i = 0, j = 0,
        result = '',
        bold = false;
      while (i < stringParts.length) {
        if (stringParts[i].toLowerCase() == queryParts[j]) {
          if (!bold) {
            result += '<strong>';
            bold = true;
          }
          j++;
        } else {
          if (bold) {
            result += '</strong>';
            bold = false;
          }
        }
        result += stringParts[i];
        i++;
      }
      return result;
    },
    id: dataToRelKeyString,
    formatSelection: dataToRelKeyString,
    dropdownCssClass: "bigdrop",
    escapeMarkup: function (m) {
      return m;
    }
  }).on("change", function (e) {
    var t = editor_templates.dataset;
    var rel = $(".dataset-search").select2("data"),
      url = myriaConnection + "/dataset/user-" + rel.userName + "/program-" + rel.programName + "/relation-" + rel.relationName;
    $.getJSON(url, function (data) {
      var html = '';
      _.each(_.zip(data.schema.columnNames, data.schema.columnTypes), function (d) {
        html += t.row({name: d[0], type: d[1]});
      });
      html = t.table({content: html});
      $("#dataset-information").html(t.dslink({url: url, user: rel.userName, program: rel.programName, name: rel.relationName}) + html);
    });
  });
}

function saveState() {
  localStorage.setItem(developerCollapseKey, $("#developer-options").hasClass('collapse in'));
  localStorage.setItem(editorLanguageKey, editorLanguage);
  editorState[editorLanguage] = {
    content: editor.getValue(),
    history: editor.getHistory()
  };
  localStorage.setItem(editorStateKey, JSON.stringify(editorState));
  localStorage.setItem(editorBackendKey, $(".backend-menu").find(":selected").val());
}

function restoreState() {
  // UI state
  var developerCollapse = localStorage.getItem(developerCollapseKey);
  if (developerCollapse === 'true') {
    $('#developer-options').addClass('in');
  }

  // Language & Editor state
  editorLanguage = localStorage.getItem(editorLanguageKey) || editorLanguage;
  editorState = JSON.parse(localStorage.getItem(editorStateKey) || "{}");
  $('.language-menu').val(editorLanguage);
  resetEditor(editorLanguage, false);
  $(".backend-menu").val(backendProcess);
  setBackend(backendProcess);

}

updateExamplesHeight = function () {
  // the height of the footer and header + nav is estimated, so is the height of the tabbar and the description
  $('#examples-list').height(_.max([$(window).height() - 250, $('#editor-column').height() - 100]));
};

$(function () {
  resetResults();

  editor.on("change", resetResults);

  $(".planner").click(function () {
    $('#editor-tabs a[href="#queryplan"]').tab('show');
    optimizeplan();
  });
  $(".compiler").click(compileplan);
  $(".executor").click(executeplan);

  $(".language-menu").change(function () {
    resetEditor($(".language-menu option:selected").val(), true);
  });
  $(".backend-menu").change(changeBackend);
  $(".example").click(function () {

    resetResults();
    var example_query = $(this).text();
    editor.setValue(example_query);
    optimizeplan();
  });
  $(".show-svg-modal").click(showSvgModal);
  $(".resize-editor").click(resizeEditor);
  initializeDatasetSearch();

  restoreState();

  optimizeplan();

  // save state every 2 seconds or when page is unloaded
  window.onbeforeunload = saveState;
  setInterval(saveState, 2000);

  $(window).resize(function () {
    updateExamplesHeight();
  });
});
