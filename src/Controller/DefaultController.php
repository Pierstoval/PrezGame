<?php

namespace App\Controller;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Cache\Adapter\AdapterInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class DefaultController extends AbstractController
{
    private $cache;

    public function __construct(AdapterInterface $cache)
    {
        $this->cache = $cache;
    }

    /**
     * @Route("/", name="default")
     */
    public function index(): Response
    {
        return $this->render('default/index.html.twig');
    }

    /**
     * @Route("/button", name="button", methods={"GET"})
     */
    public function button(): Response
    {
        return $this->render('default/button.html.twig');
    }

    /**
     * @Route("/presentation/{name}", name="presentation", methods={"GET"})
     */
    public function presentation(Session $session, $name = 'sf4'): Response
    {
        $session->set('slide_id', 'first');

        $slidesFile = "slides/$name.html.twig";

        if (!$this->get('twig')->getLoader()->exists($slidesFile)) {
            throw $this->createNotFoundException('Presentation not found.');
        }

        return $this->render('default/presentation.html.twig', [
            'presentation_slides' => $slidesFile,
        ]);
    }

    /**
     * @Route("/check-session-slide", name="check_session_slide", defaults={"_format": "json"}, methods={"GET"})
     */
    public function checkSessionSlide(Session $session): JsonResponse
    {
        if (!$session->get('slide_id')) {
            throw new AccessDeniedHttpException();
        }

        $values = $this->cache->getItem('current_slide')->get();

        return new JsonResponse($values['amount'] ?? 0);
    }
}
