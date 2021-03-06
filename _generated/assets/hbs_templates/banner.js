define(["handlebars"], function(Handlebars) { return Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "			<ul class=\"links__list\">\n"
    + ((stack1 = helpers.each.call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? depth0.media_links : depth0),{"name":"each","hash":{},"fn":container.program(2, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "			</ul>\n			";
},"2":function(container,depth0,helpers,partials,data) {
    var helper, alias1=container.escapeExpression;

  return "				<li class=\"list__item\"><a target=\"_blank\" href=\""
    + alias1(container.lambda(depth0, depth0))
    + "\">"
    + alias1(((helper = (helper = helpers.key || (data && data.key)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"key","hash":{},"data":data}) : helper)))
    + "</a></li>\n";
},"4":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "\n			<div class=\"banner__title\">\n				<div class=\"--rubrica-title\">\n"
    + ((stack1 = helpers.each.call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? depth0.titles : depth0),{"name":"each","hash":{},"fn":container.program(5, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "				</div>\n				";
},"5":function(container,depth0,helpers,partials,data) {
    var stack1, helper;

  return "					<div class=\"--uppercase title-item "
    + container.escapeExpression(((helper = (helper = helpers.key || (data && data.key)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"key","hash":{},"data":data}) : helper)))
    + "-title\">"
    + ((stack1 = container.lambda(depth0, depth0)) != null ? stack1 : "")
    + "</div>\n";
},"7":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=depth0 != null ? depth0 : (container.nullContext || {});

  return " "
    + ((stack1 = helpers.unless.call(alias1,(depth0 != null ? depth0.is_culture : depth0),{"name":"unless","hash":{},"fn":container.program(8, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + " "
    + ((stack1 = helpers["if"].call(alias1,(depth0 != null ? depth0.is_culture : depth0),{"name":"if","hash":{},"fn":container.program(10, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + " ";
},"8":function(container,depth0,helpers,partials,data) {
    return "\n				<h4 class=\"--avente-subtitle-big\">А ЭМОЦИИ СОЗДАЕМ <a href=\"#summary\" class=\"--primary-color --italic\">МЫ</a></h4> ";
},"10":function(container,depth0,helpers,partials,data) {
    return "\n				<h4 class=\"--avente-subtitle-big\">WE CREATE <a href=\"#summary\" class=\"--primary-color --italic\">EMOTIONS</a></h4> ";
},"12":function(container,depth0,helpers,partials,data) {
    var stack1, helper;

  return "\n				<div class=\"switch\">\n"
    + ((stack1 = container.invokePartial(partials.switcher,depth0,{"name":"switcher","data":data,"indent":"\t\t\t\t\t","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "					<div class=\"switch__text\">"
    + container.escapeExpression(((helper = (helper = helpers.switch_text || (depth0 != null ? depth0.switch_text : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"switch_text","hash":{},"data":data}) : helper)))
    + "</div>\n				</div>\n			</div>\n			<div class=\"banner__head\">\n				<div class=\"canvas-bg\">\n					<canvas height=\"810px\" id=\"canvas\"></canvas>\n				</div>\n				<div class=\"head-img\"></div>\n			</div>\n";
},"14":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=container.lambda, alias2=container.escapeExpression;

  return "    <div class=\"toform-btn__btn\"><a href=\"#forms-block\">"
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.header_buttons : depth0)) != null ? stack1.to_form : stack1), depth0))
    + "</a></div>\n    <div class=\"toform-btn__btn\"><a target=\"_blank\" href=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.header_buttons : depth0)) != null ? stack1.price_link : stack1), depth0))
    + "\">"
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.header_buttons : depth0)) != null ? stack1.price : stack1), depth0))
    + "</a></div>\n    ";
},"16":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "\n    <p class=\"banner__mob-text\">"
    + ((stack1 = (helpers.breaklines || (depth0 && depth0.breaklines) || helpers.helperMissing).call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? depth0.summary_top_title : depth0),{"name":"breaklines","hash":{},"data":data})) != null ? stack1 : "")
    + "</p>\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=depth0 != null ? depth0 : (container.nullContext || {});

  return "<section class=\"banner\">\n\n\n  <!-- <div class=\"banner__popup\">\n    <button class=\"close-btn\"><img src=\"assets/img/close-button.svg\"></button>\n    <div class=\"popup__container\">\n      <video id=\"popup-video\" preload=\"auto\" autoplay=\"true\" muted=\"muted\" playsInline>\n        <source type=\"video/mp4\" src=\"assets/img/popup.mp4\"></source>\n      </video>\n      <video id=\"popup-video-mob\" src=\"../assets/img/popup-mob.mp4\" autoplay=\"true\" muted=\"muted\" playsInline></video>\n    </div>\n  </div> -->\n  <div class=\"banner__grid\">\n"
    + ((stack1 = container.invokePartial(partials.header,depth0,{"name":"header","data":data,"indent":"\t\t  ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "		<div class=\"banner__wrapper wrapper\">\n"
    + ((stack1 = helpers["with"].call(alias1,(depth0 != null ? depth0.header : depth0),{"name":"with","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + " "
    + ((stack1 = helpers["with"].call(alias1,(depth0 != null ? depth0.home : depth0),{"name":"with","hash":{},"fn":container.program(4, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + " "
    + ((stack1 = helpers["with"].call(alias1,(depth0 != null ? depth0.header : depth0),{"name":"with","hash":{},"fn":container.program(7, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + " "
    + ((stack1 = helpers["with"].call(alias1,(depth0 != null ? depth0.home : depth0),{"name":"with","hash":{},"fn":container.program(12, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "		</div>\n  </div>\n  <div class=\"banner__mob-content wrapper banner__toform-btn\">\n"
    + ((stack1 = helpers["with"].call(alias1,(depth0 != null ? depth0.header : depth0),{"name":"with","hash":{},"fn":container.program(14, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + " "
    + ((stack1 = helpers["with"].call(alias1,(depth0 != null ? depth0.banner : depth0),{"name":"with","hash":{},"fn":container.program(16, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "  </div>\n</section>\n";
},"usePartial":true,"useData":true}); });