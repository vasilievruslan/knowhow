define(["handlebars"], function(Handlebars) { return Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<section id=\"forms-block\" class=\"forms\">\r\n	<div class=\"forms__container wrapper\">\r\n		<h1 class=\"forms__title --rubrica\">начать проект</h1>\r\n		<h3 class=\"forms__subtitle\">Спасибо за проявленный интерес к нашей работе. \r\n			<br>Пожалуйста, заполните форму ниже, и мы свяжемся с вами для уточнения деталей в течение одного рабочего дня.</h3>\r\n\r\n		<form action=\"\" class=\"forms__inputs\">\r\n			<div class=\"inputs\">\r\n				<input class=\"inputs__input\" placeholder=\"имя\" type=\"text\">\r\n				<input class=\"inputs__input\" placeholder=\"E-mail\" type=\"email\">\r\n				<input id=\"phone\" class=\"inputs__input\" placeholder=\"номер телефона\" type=\"tel\">\r\n				<input class=\"inputs__input\" placeholder=\"название компании\" type=\"text\">\r\n			</div>\r\n\r\n			<div class=\"forms__checkboxes\">\r\n				<div class=\"checkboxes__title forms__subtitle\">отметьте необходимое</div>\r\n				<div class=\"checkboxes__blocks\">\r\n					<div class=\"checkboxes__block\">\r\n						<div class=\"block__img --branding\"></div>\r\n						<div class=\"block__title --rubrica\">Брендинг</div>\r\n						<ul class=\"block__list\">\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> фирменный стиль</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n									\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> логотип</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> дизайн</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n									\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> брендбук</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n									\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> нейминг</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n									\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> копирайтинг</span>\r\n								</label>\r\n							</li>			\r\n						</ul>\r\n					</div>\r\n					<div class=\"checkboxes__block\">\r\n						<div class=\"block__img --prodaction\"></div>\r\n						<div class=\"block__title --rubrica\">ПРОДАКШН</div>\r\n						<ul class=\"block__list\">\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> интеграции</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> проморолики</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> полноценные сюжеты</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> канал под ключ</span>\r\n								</label>\r\n							</li>\r\n						</ul>\r\n					</div>\r\n					<div class=\"checkboxes__block\">\r\n						<div class=\"block__img --it\"></div>\r\n						<div class=\"block__title --rubrica\">it</div>\r\n						<ul class=\"block__list\">\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> сайт</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> приложение</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> CRM</span>\r\n								</label>\r\n							</li>\r\n						</ul>\r\n					</div>\r\n					<div class=\"checkboxes__block\">\r\n						<div class=\"block__img --im\"></div>\r\n						<div class=\"block__title --rubrica\">интернет-маркетинг</div>\r\n						<ul class=\"block__list\">\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> SMM-продвижение</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> SEO-продвижение</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> контент-маркетинг</span>\r\n								</label>\r\n							</li>\r\n							<li class=\"block-list__item md-checkbox\">\r\n								<label class=\"pure-material-checkbox\">\r\n									<input class=\"checkbox-item\" data-price=\"20\" type=\"checkbox\">\r\n									<span> контекстная реклама</span>\r\n								</label>\r\n							</li>\r\n						</ul>\r\n					</div>\r\n				</div>\r\n			</div>\r\n\r\n			<div class=\"forms__progressbar\">\r\n				<div class=\"forms__subtitle progressbar__title\">примерный бюджет</div>\r\n				<div class=\"progressbar wrapper\">\r\n					<div class=\"progressfill\"></div>\r\n				</div>\r\n				<p class=\"wrapper progressbar__amount\">0$</p>\r\n			</div>\r\n\r\n			<div class=\"forms__textarea\">\r\n				<div class=\"forms__subtitle textarea__title\">опишите проект</div>\r\n				<p><textarea name=\"text\"></textarea></p>\r\n			</div>\r\n\r\n			<div class=\"submit\">\r\n				<input class=\"submit__btn\" value=\"отправить\" type=\"submit\">\r\n			</div>\r\n		</form>\r\n\r\n	</div>\r\n</section>";
},"useData":true}); });