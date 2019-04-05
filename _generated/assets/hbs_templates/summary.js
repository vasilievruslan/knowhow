define(["handlebars"], function(Handlebars) { return Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "	<p class=\"summary__subtitle --uppercase\">"
    + ((stack1 = (helpers.breaklines || (depth0 && depth0.breaklines) || alias2).call(alias1,(depth0 != null ? depth0.summary_top_title : depth0),{"name":"breaklines","hash":{},"data":data})) != null ? stack1 : "")
    + "</p>\n\n	<div class=\"summary__container\">\n		<div class=\"summary__background\">\n			<canvas id=\"summary__bg\"></canvas>\n		</div>\n\n		<div class=\"wrapper summary__top-title --rubrica\">\n			"
    + ((stack1 = ((helper = (helper = helpers.title || (depth0 != null ? depth0.title : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"title","hash":{},"data":data}) : helper))) != null ? stack1 : "")
    + "\n		</div>\n		<div class=\"wrapper summary__mid-title\">\n			<p>"
    + alias4(((helper = (helper = helpers.summary_bottom_title || (depth0 != null ? depth0.summary_bottom_title : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"summary_bottom_title","hash":{},"data":data}) : helper)))
    + "</p>\n		</div>\n		<div class=\"wrapper summary__footer-title\">\n			<div class=\"footer-title__container\">\n				<div data-aos=\"fade-left\" class=\"footer-title__logo-bg\">\n					<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 431.3 234.78\"><g id=\"Слой_2\" data-name=\"Слой 2\"><g id=\"Слой_1-2\" data-name=\"Слой 1\"><path class=\"cls-1\" d=\"M55.35,156.88v73.85H0V157.91A64.73,64.73,0,0,1,6.29,129.4a72.07,72.07,0,0,1,16.86-22.54,80,80,0,0,1,53.2-20.24H276.12V72.71a12.77,12.77,0,0,0-12.77-12.77H12.88V0h249a70.72,70.72,0,0,1,28.36,5.9A79.61,79.61,0,0,1,331,45.38a65.71,65.71,0,0,1,6.29,28.36v157H275.81V144.11H68.12A12.77,12.77,0,0,0,55.35,156.88Z\"/><circle class=\"cls-2\" cx=\"400.14\" cy=\"203.61\" r=\"31.17\"/></g></g></svg>\n				</div>\n				<header data-aos=\"fade-right\" class=\"footer-title__header --rubrica --italic\">"
    + ((stack1 = ((helper = (helper = helpers.footer || (depth0 != null ? depth0.footer : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"footer","hash":{},"data":data}) : helper))) != null ? stack1 : "")
    + "</span>\n				</header>\n				<footer data-aos=\"fade-right\" class=\"footer-title__footer\">"
    + alias4(((helper = (helper = helpers.footer_subtitle || (depth0 != null ? depth0.footer_subtitle : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"footer_subtitle","hash":{},"data":data}) : helper)))
    + "</footer>\n			</div>\n		</div>\n\n	</div>\n\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "<section id=\"summary\" class=\"summary\">\n"
    + ((stack1 = helpers["with"].call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? depth0.banner : depth0),{"name":"with","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "	<div class=\"to-bottom-arrows\">\n		<a href=\"#video\">\n			<svg width=\"38px\" height=\"48px\" viewBox=\"0 0 103 129\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n			    <g id=\"Page-1\" stroke=\"none\" stroke-width=\"1\" fill=\"none\" fill-rule=\"evenodd\">\n			        <g id=\"arrows\" transform=\"translate(51.500000, 64.500000) rotate(-270.000000) translate(-51.500000, -64.500000) translate(-13.000000, 13.000000)\" fill-rule=\"nonzero\">\n			            <polygon id=\"arrows-top\" fill=\"#FABB00\" points=\"67.28 38.15 34.71 0 0 0 46.28 51.25 1.98 102.85 35.28 102.85 66.28 65.48 78.97 51.42\"></polygon>\n			            <polygon id=\"arrows-bottom\" fill=\"#3A3A3A\" points=\"117.11 38.15 84.54 0 49.83 0 96.11 51.25 51.8 102.85 85.11 102.85 116.11 65.48 128.8 51.42\"></polygon>\n			        </g>\n			    </g>\n			</svg>\n		</a>\n	</div>\n\n</section>\n";
},"useData":true}); });